import React, { useState } from 'react';

export default function FloatingInput({ id, type = "text", label, value, onChange }) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  const currentType = isPassword && showPassword ? "text" : type;

  return (
    <div className="relative floating-label-input">
      <input 
        id={id}
        type={currentType}
        placeholder=" " /* CSS hilesi için boşluk zorunlu */
        value={value}
        onChange={onChange}
        className="block w-full px-5 pt-7 pb-3 bg-surface-container-low/40 border border-white/5 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary/40 focus:bg-surface-container-low/60 text-on-surface placeholder-transparent transition-all outline-none"
      />
      <label 
        htmlFor={id} 
        className="absolute left-5 top-5 text-on-surface-variant/70 text-base transition-all pointer-events-none origin-left"
      >
        {label}
      </label>
      
      {isPassword && (
        <button 
          type="button" 
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-5 top-6 text-on-surface-variant hover:text-primary transition-colors"
        >
          <span className="material-symbols-outlined text-xl">
            {showPassword ? 'visibility_off' : 'visibility'}
          </span>
        </button>
      )}
    </div>
  );
}