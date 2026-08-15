// Birdie Squad Golf Club - Supabase client configuration
// Publishable keys are safe for browser use when Row Level Security is enabled.
(function () {
    const SUPABASE_URL = 'https://ydrrhlpvblwgwboyuwkj.supabase.co';
    const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_yDJdqAZLFId-tTzyIIJTQQ_kG_IOFqG';

    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
        console.error('Supabase browser client failed to load.');
        return;
    }

    window.birdieSupabase = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY,
        {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        }
    );
})();
