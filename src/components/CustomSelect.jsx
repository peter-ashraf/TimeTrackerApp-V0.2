import React, { useState, useRef, useEffect } from 'react';
import '../styles/custom-select.css';

const CustomSelect = ({
    options,
    value,
    onChange,
    id,
    name,
    disabled = false,
    placeholder = 'Select an option'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    const selectedOption = options.find(opt => opt.value === value) || null;

    // Handle outside click to close
    useEffect(() => {
        const handleOutsideClick = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, []);

    const handleToggle = () => {
        if (!disabled) setIsOpen(!isOpen);
    };

    const handleSelect = (optionValue) => {
        onChange({ target: { name, value: optionValue } });
        setIsOpen(false);
    };

    return (
        <div
            className={`custom-select-container ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''}`}
            ref={containerRef}
            id={id}
        >
            <div
                className="custom-select-trigger"
                onClick={handleToggle}
                tabIndex={disabled ? -1 : 0}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleToggle();
                    }
                }}
            >
                <span className="custom-select-value">
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <span className="custom-select-icon">
                    <i className={`fa-solid fa-chevron-down ${isOpen ? 'rotated' : ''}`}></i>
                </span>
            </div>

            <div className="custom-select-dropdown">
                {options.map((option) => (
                    <div
                        key={option.value}
                        className={`custom-select-option ${option.value === value ? 'selected' : ''} ${option.disabled ? 'disabled-option' : ''}`}
                        onClick={(e) => {
                            if (option.disabled) {
                                e.stopPropagation();
                                return;
                            }
                            handleSelect(option.value);
                        }}
                    >
                        {option.label}
                        {option.value === value && !option.disabled && (
                            <i className="fa-solid fa-check check-icon"></i>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default CustomSelect;
