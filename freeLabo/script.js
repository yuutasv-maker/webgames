document.addEventListener('DOMContentLoaded', () => {
    // === Header scroll effect ===
    const header = document.getElementById('main-header');
    window.addEventListener('scroll', () => {
        header.classList.toggle('scrolled', window.scrollY > 50);
    });

    // === Hamburger menu ===
    const hamburger = document.getElementById('hamburger');
    const navLinks = document.getElementById('navLinks');
    hamburger.addEventListener('click', () => {
        navLinks.classList.toggle('open');
        hamburger.classList.toggle('active');
    });
    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('open');
            hamburger.classList.remove('active');
        });
    });

    // === Smooth scroll ===
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                window.scrollTo({ top: target.offsetTop - 72, behavior: 'smooth' });
            }
        });
    });

    // === Reveal on scroll ===
    const reveals = document.querySelectorAll('.reveal');
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                revealObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(el => revealObserver.observe(el));

    // === Floating particles ===
    const canvas = document.getElementById('particles');
    if (canvas) {
        const count = 30;
        for (let i = 0; i < count; i++) {
            const dot = document.createElement('div');
            const isBlue = Math.random() > 0.4;
            const color = isBlue
                ? `rgba(91,141,239,${Math.random()*0.3+0.05})`
                : `rgba(232,135,91,${Math.random()*0.25+0.05})`;
            dot.style.cssText = `
                position:absolute;
                width:${Math.random()*3+1}px;
                height:${Math.random()*3+1}px;
                background:${color};
                border-radius:50%;
                left:${Math.random()*100}%;
                top:${Math.random()*100}%;
                animation:float ${Math.random()*8+6}s ease-in-out infinite;
                animation-delay:${Math.random()*5}s;
            `;
            canvas.appendChild(dot);
        }
        const style = document.createElement('style');
        style.textContent = `@keyframes float{0%,100%{transform:translateY(0) translateX(0);opacity:.3;}50%{transform:translateY(-${Math.random()*40+20}px) translateX(${Math.random()*20-10}px);opacity:.8;}}`;
        document.head.appendChild(style);
    }
});
