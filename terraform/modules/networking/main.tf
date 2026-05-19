# ═══════════════════════════════════════════════════════════════════════════════
# NETWORKING MODÜLÜ — VPC, Subnet, NAT Gateway
# Lambda fonksiyonlarının RDS'e güvenli erişimi için private VPC
# ═══════════════════════════════════════════════════════════════════════════════

variable "name_prefix" {
  type = string
}

variable "aws_region" {
  type = string
}

# ─── VPC ──────────────────────────────────────────────────────────────────────
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = { Name = "${var.name_prefix}-vpc" }
}

# ─── AZ'ler ──────────────────────────────────────────────────────────────────
data "aws_availability_zones" "available" {
  state = "available"
}

# ─── Public Subnet'ler (NAT Gateway için) ────────────────────────────────────
resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index)
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = { Name = "${var.name_prefix}-public-${count.index}" }
}

# ─── Private Subnet'ler (Lambda + RDS) ───────────────────────────────────────
resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index + 10)
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = { Name = "${var.name_prefix}-private-${count.index}" }
}

# ─── Internet Gateway ────────────────────────────────────────────────────────
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${var.name_prefix}-igw" }
}

# ═══════════════════════════════════════════════════════════════════════════════
# NAT — Test ortamı için NAT Instance (NAT Gateway yerine, maliyet ~$26 → ~$2)
# ═══════════════════════════════════════════════════════════════════════════════
#
# NAT Gateway saatlik ~$0.052 tüketir. 20 günlük test için bunun yerine küçük bir
# t4g.nano EC2 NAT instance kullanılıyor. Prod'a geçişte aşağıdaki "PROD" bloğu
# geri açılıp NAT instance kaldırılmalıdır.
#
# ── PROD NAT Gateway (YORUM SATIRINDA — prod'da geri açılacak) ───────────────
# resource "aws_eip" "nat" {
#   domain = "vpc"
#   tags   = { Name = "${var.name_prefix}-nat-eip" }
# }
# resource "aws_nat_gateway" "main" {
#   allocation_id = aws_eip.nat.id
#   subnet_id     = aws_subnet.public[0].id
#   tags          = { Name = "${var.name_prefix}-nat" }
#   depends_on    = [aws_internet_gateway.main]
# }

# ── NAT Instance (test) ──────────────────────────────────────────────────────
data "aws_ami" "al2023_arm" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-arm64"]
  }
  filter {
    name   = "architecture"
    values = ["arm64"]
  }
}

resource "aws_security_group" "nat" {
  name_prefix = "${var.name_prefix}-nat-"
  vpc_id      = aws_vpc.main.id
  description = "NAT instance routing VPC traffic to internet"

  ingress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = [aws_vpc.main.cidr_block]
    description = "VPC ici tum trafik"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.name_prefix}-nat-sg" }
}

resource "aws_instance" "nat" {
  ami                         = data.aws_ami.al2023_arm.id
  instance_type               = "t4g.micro" # free-tier uygun (t4g.nano değil)
  subnet_id                   = aws_subnet.public[0].id
  vpc_security_group_ids      = [aws_security_group.nat.id]
  associate_public_ip_address = true
  source_dest_check           = false # NAT için zorunlu

  user_data = <<-EOF
    #!/bin/bash
    set -e
    sysctl -w net.ipv4.ip_forward=1
    echo 'net.ipv4.ip_forward=1' > /etc/sysctl.d/99-nat.conf
    IFACE=$(ip -o -4 route show to default | awk '{print $5}')
    iptables -t nat -A POSTROUTING -o "$IFACE" -j MASQUERADE
    iptables -A FORWARD -j ACCEPT
  EOF

  tags = { Name = "${var.name_prefix}-nat-instance" }

  depends_on = [aws_internet_gateway.main]
}

# ─── Route Table: Public ─────────────────────────────────────────────────────
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = { Name = "${var.name_prefix}-public-rt" }
}

resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# ─── Route Table: Private ────────────────────────────────────────────────────
# Private subnet'lerin internet çıkışı NAT instance üzerinden.
# (PROD'da: nat_gateway_id = aws_nat_gateway.main.id)
resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block           = "0.0.0.0/0"
    network_interface_id = aws_instance.nat.primary_network_interface_id
  }

  tags = { Name = "${var.name_prefix}-private-rt" }
}

resource "aws_route_table_association" "private" {
  count          = 2
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

# ─── Outputs ─────────────────────────────────────────────────────────────────
output "vpc_id" {
  value = aws_vpc.main.id
}

output "public_subnet_ids" {
  value = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  value = aws_subnet.private[*].id
}
