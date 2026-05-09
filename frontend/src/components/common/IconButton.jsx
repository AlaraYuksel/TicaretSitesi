export const IconButton = ({ icon, onClick, active, variant = 'default' }) => {
  const baseClasses = "flex items-center justify-center transition-all duration-200";
  const variants = {
    default: "text-[#c1c6d7] hover:bg-[#353534] hover:text-[#e5e2e1] p-2 rounded-md",
    rounded: "text-[#c1c6d7] hover:bg-[#353534] hover:text-[#e5e2e1] p-2 rounded-full",
    primary: "w-12 h-12 text-[#e5e2e1] bg-[#2a2a2a] rounded-md hover:bg-surface-container-highest",
  };

  return (
    <button className={`${baseClasses} ${variants[variant]}`} onClick={onClick}>
      <span className="material-symbols-outlined" style={active ? {fontVariationSettings: "'FILL' 1"} : {}}>
        {icon}
      </span>
    </button>
  );
};