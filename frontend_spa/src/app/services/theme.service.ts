import { Injectable, signal, effect } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class ThemeService {
    public theme = signal<'dark' | 'light'>('dark');

    constructor() {
        // Load saved theme
        const savedTheme = localStorage.getItem('theme') as 'dark' | 'light';
        if (savedTheme) {
            this.theme.set(savedTheme);
        }

        // Apply theme effect
        effect(() => {
            const currentTheme = this.theme();
            const themeName = currentTheme === 'dark' ? 'mnemos-dark' : 'mnemos-light';
            document.documentElement.setAttribute('data-theme', themeName);
            localStorage.setItem('theme', currentTheme);
        });
    }

    toggleTheme() {
        this.theme.update(t => t === 'dark' ? 'light' : 'dark');
    }
}
