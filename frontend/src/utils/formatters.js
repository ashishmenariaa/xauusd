// utils/formatters.js - Formatting Utilities
export function formatPrice(price, decimals = 2) {
    if (price === null || price === undefined) return '—';
    return parseFloat(price).toFixed(decimals);
}

export function formatNumber(number, decimals = 2) {
    if (number === null || number === undefined) return '—';
    return parseFloat(number).toFixed(decimals);
}

export function formatTime(date, format = 'HH:mm') {
    if (!date) return '—';
    
    const d = new Date(date);
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const seconds = d.getSeconds().toString().padStart(2, '0');
    
    switch (format) {
        case 'HH:mm:ss':
            return `${hours}:${minutes}:${seconds}`;
        case 'HH:mm':
            return `${hours}:${minutes}`;
        case 'DD/MM HH:mm':
            const day = d.getDate().toString().padStart(2, '0');
            const month = (d.getMonth() + 1).toString().padStart(2, '0');
            return `${day}/${month} ${hours}:${minutes}`;
        default:
            return d.toLocaleTimeString();
    }
}

export function formatDuration(milliseconds) {
    if (!milliseconds) return '—';
    
    const minutes = Math.floor(milliseconds / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
}

export function formatPercentage(value, decimals = 1) {
    if (value === null || value === undefined) return '—';
    return `${parseFloat(value).toFixed(decimals)}%`;
}

export function formatCurrency(amount, currency = '$') {
    if (amount === null || amount === undefined) return '—';
    const num = parseFloat(amount);
    return `${currency}${Math.abs(num).toFixed(2)}`;
}

export function capitalizeFirst(str) {
    if (!str) return '—';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
