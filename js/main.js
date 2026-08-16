// Birdie Squad Golf Club - Main JavaScript

// Shared Supabase Auth bridge. Loaded on every page so there is exactly one
// real login authority for the whole site. Role/approval data is read from
// `user_profiles` (RLS-governed); nothing here is browser-editable authority.
const BirdieAuth = (function () {
    const SUPABASE_URL = 'https://ydrrhlpvblwgwboyuwkj.supabase.co';
    const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_yDJdqAZLFId-tTzyIIJTQQ_kG_IOFqG';
    const SUPABASE_MODULE_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0/+esm';
    const LEGACY_AUTH_STORAGE_KEY = 'birdiesgc_auth_session';

    try {
        localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
    } catch (error) {
        // Storage can be unavailable in strict privacy modes.
    }

    const state = { client: null, clientPromise: null, session: null, profile: null };
    const listeners = [];

    function ensureClient() {
        if (state.client) return Promise.resolve(state.client);
        if (state.clientPromise) return state.clientPromise;

        state.clientPromise = import(SUPABASE_MODULE_URL)
            .then(function (module) {
                state.client = module.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
                    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
                });
                state.client.auth.onAuthStateChange(function () {
                    window.setTimeout(refresh, 0);
                });
                return state.client;
            })
            .catch(function (error) {
                state.clientPromise = null;
                throw error;
            });

        return state.clientPromise;
    }

    async function loadProfile(user) {
        if (!user) {
            state.profile = null;
            return null;
        }
        const client = await ensureClient();
        const result = await client.from('user_profiles').select('role, member_id, approved').eq('id', user.id).maybeSingle();
        if (result.error) {
            console.error('Birdie Auth profile load failed:', result.error);
            // Fail closed: an unreadable profile is treated as not approved,
            // matching RLS's own default (new accounts start unapproved).
            state.profile = { role: 'member', member_id: null, approved: false };
            return state.profile;
        }
        state.profile = result.data || { role: 'member', member_id: null, approved: false };
        return state.profile;
    }

    function notify() {
        const detail = { session: state.session, profile: state.profile };
        listeners.forEach(function (fn) {
            try {
                fn(detail);
            } catch (error) {
                console.error('Birdie Auth listener failed:', error);
            }
        });
        document.dispatchEvent(new CustomEvent('birdie-auth-changed', { detail: detail }));
    }

    async function refresh() {
        try {
            const client = await ensureClient();
            const result = await client.auth.getSession();
            state.session = result.data && result.data.session ? result.data.session : null;
            await loadProfile(state.session ? state.session.user : null);
        } catch (error) {
            console.error('Birdie Auth session refresh failed:', error);
            state.session = null;
            state.profile = null;
        }
        notify();
    }

    async function signIn(email, password) {
        const client = await ensureClient();
        const result = await client.auth.signInWithPassword({ email: email, password: password });
        if (result.error) throw result.error;
        state.session = result.data.session;
        await loadProfile(result.data.user);
        notify();
        return state.session;
    }

    async function signOut() {
        const client = await ensureClient();
        await client.auth.signOut();
        state.session = null;
        state.profile = null;
        notify();
    }

    function onChange(fn) {
        listeners.push(fn);
    }

    return {
        ensureClient: ensureClient,
        refresh: refresh,
        signIn: signIn,
        signOut: signOut,
        onChange: onChange,
        getSession: function () { return state.session; },
        getProfile: function () { return state.profile; }
    };
})();

window.BirdieAuth = BirdieAuth;

document.addEventListener('DOMContentLoaded', function() {
    const headerCta = document.querySelector('.header-cta');
    const mobileNavList = document.querySelector('.nav-mobile .nav-list');

    function roleLabel(role) {
        const labels = { admin: 'Admin', management: 'Management', scorer: 'Scorer', member: 'Member' };
        return labels[role] || 'Member';
    }

    function openLoginModal() {
        const modal = document.getElementById('auth-modal');
        if (!modal) return;
        modal.classList.add('active');
        const usernameInput = modal.querySelector('#auth-username');
        if (usernameInput) usernameInput.focus();
    }

    function closeLoginModal() {
        const modal = document.getElementById('auth-modal');
        if (!modal) return;
        modal.classList.remove('active');
        const form = modal.querySelector('#auth-form');
        const error = modal.querySelector('.auth-error');
        if (form) form.reset();
        if (error) error.textContent = '';
    }

    function routeByRole(role) {
        // The Events page renders its member hub in place; do not navigate away from it.
        if (isEventsPage()) return;
        if (role === 'admin' || role === 'management') {
            window.location.href = 'governance.html';
            return;
        }
        window.location.href = 'member-network.html';
    }

    function updateAuthButtons() {
        const session = BirdieAuth.getSession();
        const profile = BirdieAuth.getProfile();
        const desktopBtn = document.getElementById('login-trigger');
        const mobileBtn = document.getElementById('login-trigger-mobile');
        const roleTag = document.getElementById('auth-role-tag');

        if (!desktopBtn || !mobileBtn || !roleTag) return;

        if (session) {
            desktopBtn.textContent = 'Logout';
            mobileBtn.textContent = 'Logout';
            roleTag.textContent = (profile && profile.approved === false)
                ? 'Pending Approval'
                : roleLabel(profile ? profile.role : 'member');
            roleTag.classList.add('active');
        } else {
            desktopBtn.textContent = 'Login';
            mobileBtn.textContent = 'Login';
            roleTag.textContent = '';
            roleTag.classList.remove('active');
        }
    }

    function handleAuthButtonClick() {
        if (BirdieAuth.getSession()) {
            BirdieAuth.signOut().catch(function (error) {
                console.error('Birdie logout failed:', error);
            });
            return;
        }
        openLoginModal();
    }

    function createAuthUi() {
        if (headerCta && !document.getElementById('login-trigger')) {
            const loginBtn = document.createElement('button');
            loginBtn.id = 'login-trigger';
            loginBtn.type = 'button';
            loginBtn.className = 'btn btn-login';
            loginBtn.textContent = 'Login';
            headerCta.insertBefore(loginBtn, headerCta.firstChild);

            const roleTag = document.createElement('span');
            roleTag.id = 'auth-role-tag';
            roleTag.className = 'auth-role-tag';
            roleTag.setAttribute('aria-live', 'polite');
            headerCta.insertBefore(roleTag, loginBtn.nextSibling);
        }

        if (mobileNavList && !document.getElementById('login-trigger-mobile')) {
            const item = document.createElement('li');
            const loginMobileBtn = document.createElement('button');
            loginMobileBtn.id = 'login-trigger-mobile';
            loginMobileBtn.type = 'button';
            loginMobileBtn.className = 'nav-link nav-link-btn';
            loginMobileBtn.textContent = 'Login';
            item.appendChild(loginMobileBtn);
            mobileNavList.appendChild(item);
        }

        if (!document.getElementById('auth-modal')) {
            const modal = document.createElement('div');
            modal.id = 'auth-modal';
            modal.className = 'auth-modal';
            modal.innerHTML = `
                <div class="auth-modal-panel" role="dialog" aria-modal="true" aria-labelledby="auth-title">
                    <button type="button" class="auth-close" id="auth-close" aria-label="Close login">&times;</button>
                    <h3 id="auth-title">Member Login</h3>
                    <p class="auth-subtitle">Use your Birdie Squad email and password.</p>
                    <form id="auth-form">
                        <label for="auth-username">Email</label>
                        <input id="auth-username" name="email" type="email" required autocomplete="email" placeholder="name@example.com">
                        <label for="auth-password">Password</label>
                        <input id="auth-password" name="password" type="password" required autocomplete="current-password">
                        <p class="auth-error" aria-live="polite"></p>
                        <button type="submit" class="btn btn-primary auth-submit">Sign In</button>
                    </form>
                </div>
            `;
            document.body.appendChild(modal);
        }
    }

    function bindAuthEvents() {
        const desktopBtn = document.getElementById('login-trigger');
        const mobileBtn = document.getElementById('login-trigger-mobile');
        const modal = document.getElementById('auth-modal');
        const closeBtn = document.getElementById('auth-close');
        const form = document.getElementById('auth-form');

        if (desktopBtn) desktopBtn.addEventListener('click', handleAuthButtonClick);
        if (mobileBtn) {
            mobileBtn.addEventListener('click', function() {
                handleAuthButtonClick();
                const mobileNav = document.querySelector('.nav-mobile');
                const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
                if (mobileNav) mobileNav.classList.remove('active');
                if (mobileMenuBtn) {
                    const spans = mobileMenuBtn.querySelectorAll('span');
                    if (spans[0]) spans[0].style.transform = 'none';
                    if (spans[1]) spans[1].style.opacity = '1';
                    if (spans[2]) spans[2].style.transform = 'none';
                }
            });
        }

        if (closeBtn) closeBtn.addEventListener('click', closeLoginModal);
        if (modal) {
            modal.addEventListener('click', function(event) {
                if (event.target === modal) {
                    closeLoginModal();
                }
            });
        }

        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') {
                closeLoginModal();
            }
        });

        if (form) {
            form.addEventListener('submit', function(event) {
                event.preventDefault();
                const email = (form.email.value || '').trim();
                const password = form.password.value || '';
                const error = form.querySelector('.auth-error');
                const submitBtn = form.querySelector('.auth-submit');

                if (error) error.textContent = '';
                if (!email || !password) {
                    if (error) error.textContent = 'Enter your email and password.';
                    return;
                }

                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.textContent = 'Signing in...';
                }

                BirdieAuth.signIn(email, password)
                    .then(function () {
                        updateAuthButtons();
                        closeLoginModal();
                        const profile = BirdieAuth.getProfile();
                        routeByRole(profile ? profile.role : 'member');
                    })
                    .catch(function (signInError) {
                        console.error('Birdie login failed:', signInError);
                        if (error) error.textContent = 'Login failed. Check your email and password.';
                    })
                    .finally(function () {
                        if (submitBtn) {
                            submitBtn.disabled = false;
                            submitBtn.textContent = 'Sign In';
                        }
                    });
            });
        }
    }

    createAuthUi();
    bindAuthEvents();
    updateAuthButtons();
    BirdieAuth.onChange(updateAuthButtons);
    BirdieAuth.refresh();

    function ensureEventsNavLinks() {
        const navLists = document.querySelectorAll('.nav .nav-list');
        navLists.forEach(function(list) {
            if (!list || list.querySelector('a[href="/events"]')) return;

            const item = document.createElement('li');
            const link = document.createElement('a');
            link.href = '/events';
            link.className = 'nav-link';
            link.textContent = 'Events';

            const currentPath = window.location.pathname.toLowerCase();
            const isEventsPage = currentPath.endsWith('/events.html') || currentPath.endsWith('events.html') || currentPath === '/events';
            if (isEventsPage) {
                link.classList.add('active');
            }

            item.appendChild(link);

            const contactLink = Array.from(list.querySelectorAll('a')).find(function(anchor) {
                return anchor.getAttribute('href') === 'contact.html';
            });

            if (contactLink && contactLink.parentElement) {
                list.insertBefore(item, contactLink.parentElement);
            } else {
                list.appendChild(item);
            }
        });
    }

    function isHomepage() {
        const path = (window.location.pathname || '').toLowerCase();
        const lastSegment = path.split('/').filter(Boolean).pop() || '';
        return path === '/' || path === '' || lastSegment === 'index.html';
    }

    function isEventsPage() {
        const path = (window.location.pathname || '').toLowerCase();
        return path.endsWith('events.html') || path === '/events';
    }

    function getEventsApi() {
        return window.birdieEventsData || null;
    }

    function getFeaturedEvent() {
        const api = getEventsApi();
        return api ? api.getFeaturedUpcomingEvent() : null;
    }

    function toSADateTime(event) {
        return new Date(event.date + 'T' + event.reportingTime + ':00+02:00');
    }

    function formatEventDate(dateString) {
        const eventDate = new Date(dateString + 'T00:00:00+02:00');
        return eventDate.toLocaleDateString('en-ZA', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
    }

    function getCountdownParts(eventDate) {
        const now = new Date();
        const diff = eventDate.getTime() - now.getTime();
        if (diff <= 0) return null;

        const totalSeconds = Math.floor(diff / 1000);
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        return {
            days: String(days).padStart(2, '0'),
            hours: String(hours).padStart(2, '0'),
            minutes: String(minutes).padStart(2, '0'),
            seconds: String(seconds).padStart(2, '0')
        };
    }

    function startCountdownTimer(root, event) {
        const target = toSADateTime(event);
        const valueEls = {
            days: root.querySelector('[data-countdown="days"]'),
            hours: root.querySelector('[data-countdown="hours"]'),
            minutes: root.querySelector('[data-countdown="minutes"]'),
            seconds: root.querySelector('[data-countdown="seconds"]')
        };
        const fallbackEl = root.querySelector('[data-countdown-fallback]');

        function tick() {
            const parts = getCountdownParts(target);
            if (!parts) {
                if (fallbackEl) fallbackEl.style.display = 'block';
                const grid = root.querySelector('.event-countdown-grid');
                if (grid) grid.style.display = 'none';
                return;
            }

            if (valueEls.days) valueEls.days.textContent = parts.days;
            if (valueEls.hours) valueEls.hours.textContent = parts.hours;
            if (valueEls.minutes) valueEls.minutes.textContent = parts.minutes;
            if (valueEls.seconds) valueEls.seconds.textContent = parts.seconds;
        }

        tick();
        return window.setInterval(tick, 1000);
    }

    function renderCountdownMarkup(event) {
        return `
            <div class="event-countdown-wrap">
                <div class="event-countdown-grid">
                    <div class="event-countdown-cell"><span data-countdown="days">00</span><small>Days</small></div>
                    <div class="event-countdown-cell"><span data-countdown="hours">00</span><small>Hours</small></div>
                    <div class="event-countdown-cell"><span data-countdown="minutes">00</span><small>Minutes</small></div>
                    <div class="event-countdown-cell"><span data-countdown="seconds">00</span><small>Seconds</small></div>
                </div>
                <p class="event-countdown-fallback" data-countdown-fallback style="display:none;">This event has taken place. View highlights and upcoming events.</p>
            </div>
        `;
    }

    function renderHomepageCountdown() {
        if (!isHomepage()) return;
        const event = getFeaturedEvent();
        if (!event) return;

        const heroSection = document.querySelector('.hero');
        if (!heroSection || document.getElementById('home-next-event')) return;

        const section = document.createElement('section');
        section.id = 'home-next-event';
        section.className = 'home-event-countdown-section';
        section.innerHTML = `
            <div class="container">
                <div class="home-event-countdown-card">
                    <p class="home-event-kicker">Next Event</p>
                    <h2>${event.title}</h2>
                    <p class="home-event-meta">${formatEventDate(event.date)} · ${event.venue}</p>
                    ${renderCountdownMarkup(event)}
                    <a href="/events#${event.id}" class="btn btn-primary">View Event Details</a>
                </div>
            </div>
        `;
        heroSection.insertAdjacentElement('afterend', section);
        startCountdownTimer(section, event);
    }

    function renderEventsPage() {
        if (!isEventsPage()) return;
        const api = getEventsApi();
        if (!api) return;

        const featured = api.getFeaturedUpcomingEvent();
        const upcoming = api.getUpcomingEvents();
        const past = api.getPastEvents();

        const featuredMount = document.getElementById('events-featured-mount');
        const listMount = document.getElementById('events-list-mount');
        const reportsMount = document.getElementById('events-reports-mount');

        if (featured && featuredMount) {
            featuredMount.innerHTML = `
                <article id="${featured.id}" class="event-featured-card">
                    <div class="event-featured-media">
                        <img src="${featured.image}" alt="${featured.title} poster" class="event-featured-image">
                    </div>
                    <div class="event-featured-content">
                        <p class="event-featured-kicker">Featured Event</p>
                        <h2>${featured.title}</h2>
                        <p class="event-featured-desc">${featured.description}</p>
                        <div class="event-featured-meta">
                            <p><strong>Date:</strong> ${formatEventDate(featured.date)}</p>
                            <p><strong>Venue:</strong> ${featured.venue}</p>
                            <p><strong>Reporting Time:</strong> ${featured.reportingTime}</p>
                            <p><strong>Tee Off:</strong> ${featured.teeOffTime}</p>
                            <p><strong>Green Fee:</strong> ${featured.greenFee}</p>
                            <p><strong>Note:</strong> ${featured.note}</p>
                            <p><strong>Sponsor:</strong> ${featured.sponsor}</p>
                        </div>
                        <div class="event-prizes">
                            <h3>Prizes</h3>
                            <ul>${featured.prizes.map(function(prize) { return '<li><span>' + prize.position + '</span><strong>' + prize.amount + '</strong></li>'; }).join('')}</ul>
                        </div>
                        <div class="event-cta-group">
                            <a href="contact.html?subject=golf-day" class="btn btn-primary">Register Interest</a>
                            <a href="contact.html" class="btn btn-outline">Contact Club</a>
                            <a href="contact.html?subject=partnership" class="btn btn-secondary">Sponsor This Event</a>
                        </div>
                    </div>
                </article>
                <div class="events-page-countdown">
                    <h3>Countdown to Tee-Off Day</h3>
                    ${renderCountdownMarkup(featured)}
                </div>
            `;
            startCountdownTimer(featuredMount, featured);
        }

        if (listMount) {
            if (!upcoming.length) {
                listMount.innerHTML = '<p class="events-empty">No upcoming events published yet.</p>';
            } else {
                listMount.innerHTML = upcoming.map(function(event) {
                    return `
                        <article class="event-calendar-card">
                            <div>
                                <p class="event-calendar-date">${formatEventDate(event.date)}</p>
                                <h3>${event.title}</h3>
                                <p>${event.shortDescription}</p>
                            </div>
                            <div class="event-calendar-meta">
                                <p><strong>Venue:</strong> ${event.venue}</p>
                                <p><strong>Reporting:</strong> ${event.reportingTime}</p>
                                <p><strong>Tee Off:</strong> ${event.teeOffTime}</p>
                                <a href="#${event.id}" class="programme-link">View Featured Details &rarr;</a>
                            </div>
                        </article>
                    `;
                }).join('');
            }
        }

        if (reportsMount) {
            const pastWithReports = past.filter(function(event) {
                return !!event.report;
            });
            if (!pastWithReports.length) {
                reportsMount.innerHTML = '<div class="event-report-empty"><h3>Past Event Reports</h3><p>Event reports and galleries will appear here after each golf day.</p></div>';
            } else {
                reportsMount.innerHTML = pastWithReports.map(function(event) {
                    return `
                        <article class="event-report-card">
                            <h3>${event.title}</h3>
                            <p>${event.report.summary || ''}</p>
                        </article>
                    `;
                }).join('');
            }
        }
    }


    function createWhatsAppFab() {
        if (document.getElementById('whatsapp-fab')) return;

        const waLink = document.createElement('a');
        waLink.id = 'whatsapp-fab';
        waLink.className = 'whatsapp-fab';
        waLink.href = 'https://wa.me/27839929808?text=Hello%20Birdie%20Squad%2C%20I%20have%20an%20enquiry.';
        waLink.target = '_blank';
        waLink.rel = 'noopener noreferrer';
        waLink.setAttribute('aria-label', 'Chat with Birdie Squad on WhatsApp');
        waLink.innerHTML = `
            <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
                <path fill="currentColor" d="M19.11 17.34c-.25-.13-1.47-.73-1.7-.81-.23-.08-.4-.12-.57.12-.17.24-.65.81-.8.98-.15.17-.29.19-.54.06-.25-.13-1.04-.38-1.98-1.22-.73-.65-1.22-1.46-1.36-1.71-.14-.25-.01-.39.11-.52.11-.11.25-.29.38-.43.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.57-1.37-.78-1.88-.2-.49-.41-.42-.57-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1s.9 2.44 1.03 2.61c.13.17 1.77 2.7 4.28 3.78.6.26 1.07.42 1.44.54.61.19 1.17.16 1.61.1.49-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.06-.1-.23-.17-.48-.29z"/>
                <path fill="currentColor" d="M16.01 3.2c-7.06 0-12.8 5.73-12.8 12.78 0 2.25.59 4.45 1.7 6.39L3 28.8l6.58-1.72a12.8 12.8 0 0 0 6.43 1.74c7.06 0 12.79-5.73 12.79-12.79S23.07 3.2 16.01 3.2zm0 23.46c-2.03 0-4.02-.55-5.75-1.6l-.41-.25-3.91 1.02 1.05-3.8-.27-.42a10.6 10.6 0 0 1-1.64-5.63c0-5.85 4.77-10.61 10.64-10.61 5.86 0 10.62 4.76 10.62 10.62 0 5.86-4.76 10.62-10.61 10.62z"/>
            </svg>
            <span>WhatsApp</span>
        `;

        document.body.appendChild(waLink);
    }

    function bindContactMailtoForm() {
        const contactForm = document.querySelector('.contact-form');
        if (!contactForm) return;

        contactForm.addEventListener('submit', function(event) {
            if (!contactForm.checkValidity()) {
                contactForm.reportValidity();
                return;
            }

            event.preventDefault();

            const fullName = (contactForm.querySelector('#name')?.value || '').trim();
            const email = (contactForm.querySelector('#email')?.value || '').trim();
            const phone = (contactForm.querySelector('#phone')?.value || '').trim();
            const subject = (contactForm.querySelector('#subject')?.value || 'general').trim();
            const message = (contactForm.querySelector('#message')?.value || '').trim();

            const subjectLabelMap = {
                membership: 'Membership Inquiry',
                'golf-day': 'Golf Day Inquiry',
                partnership: 'Partnership Inquiry',
                network: 'Member Network Inquiry',
                general: 'General Inquiry'
            };
            const subjectLabel = subjectLabelMap[subject] || 'General Inquiry';
            const mailtoSubject = `Website Enquiry: ${subjectLabel}`;
            const mailtoBody = [
                'Full Name: ' + fullName,
                'Email: ' + email,
                'Phone: ' + (phone || 'Not provided'),
                '',
                'Message:',
                message
            ].join('\n');

            const mailtoUrl = 'mailto:info@birdiesgc.co.za?subject='
                + encodeURIComponent(mailtoSubject)
                + '&body=' + encodeURIComponent(mailtoBody);

            window.location.href = mailtoUrl;
        });
    }

    ensureEventsNavLinks();

    renderEventsPage();
    createWhatsAppFab();
    bindContactMailtoForm();

    // Mobile Menu Toggle
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const mobileNav = document.querySelector('.nav-mobile');
    
    if (mobileMenuBtn && mobileNav) {
        mobileMenuBtn.addEventListener('click', function() {
            mobileNav.classList.toggle('active');
            
            // Animate hamburger
            const spans = mobileMenuBtn.querySelectorAll('span');
            if (mobileNav.classList.contains('active')) {
                spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
                spans[1].style.opacity = '0';
                spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
            } else {
                spans[0].style.transform = 'none';
                spans[1].style.opacity = '1';
                spans[2].style.transform = 'none';
            }
        });
        
        // Close mobile menu when clicking a link
        const mobileLinks = mobileNav.querySelectorAll('.nav-link');
        mobileLinks.forEach(link => {
            link.addEventListener('click', function() {
                mobileNav.classList.remove('active');
                const spans = mobileMenuBtn.querySelectorAll('span');
                spans[0].style.transform = 'none';
                spans[1].style.opacity = '1';
                spans[2].style.transform = 'none';
            });
        });
    }
    
    // Header Scroll Effect
    const header = document.querySelector('.header');
    let lastScroll = 0;
    
    window.addEventListener('scroll', function() {
        const currentScroll = window.pageYOffset;
        
        if (currentScroll > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
        
        lastScroll = currentScroll;
    });
    
    // Smooth Scroll for Anchor Links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href !== '#') {
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            }
        });
    });
    
    // Handle image fallbacks - show fallback div when image fails
    document.querySelectorAll('.about-img').forEach(img => {
        img.addEventListener('error', function() {
            this.style.display = 'none';
            const fallback = this.parentElement.querySelector('.image-fallback');
            if (fallback) {
                fallback.style.display = 'flex';
            }
        });
    });
    
    // Form Validation (if forms exist)
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('submit', function(e) {
            const required = form.querySelectorAll('[required]');
            let valid = true;
            
            required.forEach(field => {
                if (!field.value.trim()) {
                    valid = false;
                    field.style.borderColor = '#e74c3c';
                } else {
                    field.style.borderColor = '#E8F0E9';
                }
            });
            
            if (!valid) {
                e.preventDefault();
                alert('Please fill in all required fields.');
            }
        });
    });
    
    // Lazy Loading for Images
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                        imageObserver.unobserve(img);
                    }
                }
            });
        });
        
        document.querySelectorAll('img[data-src]').forEach(img => {
            imageObserver.observe(img);
        });
    }
    
    // Add animation class on scroll
    const animateElements = document.querySelectorAll('.pillar-card, .programme-card, .tier-card');
    
    if ('IntersectionObserver' in window) {
        const animationObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }
            });
        }, {
            threshold: 0.1
        });
        
        animateElements.forEach(el => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(20px)';
            el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            animationObserver.observe(el);
        });
    }
});

// Utility: Format phone number
function formatPhone(input) {
    input.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 0) {
            if (value.length <= 3) {
                value = value;
            } else if (value.length <= 6) {
                value = value.slice(0, 3) + ' ' + value.slice(3);
            } else {
                value = value.slice(0, 3) + ' ' + value.slice(3, 6) + ' ' + value.slice(6);
            }
        }
        e.target.value = value;
    });
}

// Apply phone formatting to all tel inputs
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('input[type="tel"]').forEach(input => {
        formatPhone(input);
    });
});
