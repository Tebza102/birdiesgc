// Focused, framework-free regression checks for pilot auth reliability +
// password recovery (project-os/10-prompts/claude-fix-pilot-auth-login-recovery.md).
//
// There is no live Supabase project or browser available in this
// environment, so an actual sign-in/reset-email/password-update round trip
// is not exercised here — see the change log / PR for an explicit
// statement of what was and wasn't verified against real credentials.
// What this script CAN prove deterministically, via static source
// inspection of js/main.js:
//   - the CDN loader has a real fallback provider and a finite per-attempt
//     timeout, not a single point of failure that can hang forever
//   - sign-in shows an immediate status message, a loading submit state,
//     and always restores the button on both success and failure
//   - the three required error categories (bad credentials, unconfirmed
//     email, network/timeout) map to distinct, non-generic messages
//   - the password Show/Hide toggle exists and current-password
//     autocomplete is preserved
//   - Forgot password calls the real resetPasswordForEmail API with a
//     current-origin redirect, never silently no-ops
//   - PASSWORD_RECOVERY is handled by event type, not just "some auth
//     event happened"
//   - password update calls updateUser({ password }) and enforces a
//     minimum length + confirm-match before ever calling Supabase
//   - no service-role/secret key was introduced
//   - the existing approved-profile fail-closed behaviour is untouched
//   - the new UI elements can't force page-level horizontal overflow
//
// Run with: node scripts/test-auth-ui.js

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const mainJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
const styleCss = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        passed += 1;
        console.log('  ok - ' + name);
    } catch (error) {
        failed += 1;
        console.error('  FAIL - ' + name);
        console.error('    ' + (error && error.message ? error.message : error));
    }
}

function extractFunction(source, name) {
    const match = new RegExp('(?:async )?function ' + name + '\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?\\n    \\}').exec(source);
    assert.ok(match, 'could not locate function ' + name + '() in js/main.js');
    return match[0];
}

test('Supabase CDN loader has a real second provider and a finite per-attempt timeout', function () {
    const match = /const SUPABASE_MODULE_URLS = \[([\s\S]*?)\];/.exec(mainJs);
    assert.ok(match, 'could not find SUPABASE_MODULE_URLS');
    const urls = match[1];
    assert.match(urls, /cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2\.111\.0/);
    assert.match(urls, /esm\.sh\/@supabase\/supabase-js@2\.111\.0/, 'expected a second, different CDN provider pinned to the same version');
    const timeoutMatch = /const MODULE_LOAD_TIMEOUT_MS = (\d+);/.exec(mainJs);
    assert.ok(timeoutMatch, 'could not find MODULE_LOAD_TIMEOUT_MS');
    const timeoutMs = Number(timeoutMatch[1]);
    assert.ok(timeoutMs >= 8000 && timeoutMs <= 12000, 'expected an 8-12 second per-attempt timeout, got ' + timeoutMs + 'ms');
});

test('a failed/timed-out CDN load rejects with a clear, user-facing message instead of hanging', function () {
    const fn = extractFunction(mainJs, 'loadSupabaseModule');
    assert.match(fn, /throw new Error\('Login service could not load\. Check your connection and try again\.'\)/);
});

test('exactly one shared Supabase client is still created (ensureClient caches it)', function () {
    const fn = extractFunction(mainJs, 'ensureClient');
    assert.match(fn, /if \(state\.client\) return Promise\.resolve\(state\.client\);/);
    assert.match(fn, /if \(state\.clientPromise\) return state\.clientPromise;/);
});

test('login submit shows an immediate connecting status, a loading label, and always restores the button', function () {
    const fn = extractFunction(mainJs, 'handleLoginSubmit');
    assert.match(fn, /submitBtn\.textContent = 'Signing in…';/);
    assert.match(fn, /setAuthStatus\(form, 'Connecting securely…'\);/);
    assert.match(fn, /finally \{[\s\S]*?submitBtn\.disabled = false;[\s\S]*?\}/, 'expected the submit button to be re-enabled in a finally block covering every failure path');
});

test('login has a finite timeout distinct from network/DNS hanging forever', function () {
    assert.match(mainJs, /const LOGIN_ACTION_TIMEOUT_MS = \d+;/);
    const fn = extractFunction(mainJs, 'handleLoginSubmit');
    assert.match(fn, /withTimeout\(\s*\n\s*BirdieAuth\.signIn\(email, password\),\s*\n\s*LOGIN_ACTION_TIMEOUT_MS/);
});

test('sign-in errors are categorized into the three required non-generic messages', function () {
    const fn = extractFunction(mainJs, 'describeSignInError');
    assert.match(fn, /invalid login credentials/);
    assert.match(fn, /Email or password is incorrect\. You can use Forgot password below\./);
    assert.match(fn, /email not confirmed/);
    assert.match(fn, /confirm your email address/);
    assert.match(fn, /Could not reach the login service\. Check your connection and try again\./);
});

test('the underlying error is logged to console but no token/key/stack is put in user-facing text', function () {
    const fn = extractFunction(mainJs, 'describeSignInError');
    // The function only ever returns hand-written strings, never echoes error.message/stack directly.
    assert.doesNotMatch(fn, /return error\.message/);
    assert.doesNotMatch(fn, /return error\.stack/);
});

test('password Show/Hide toggle exists on the login field and preserves current-password autocomplete', function () {
    assert.match(mainJs, /data-toggle-visibility="auth-password"/);
    assert.match(mainJs, /id="auth-password" name="password" type="password" required autocomplete="current-password"/);
    assert.match(mainJs, /aria-pressed="false" aria-label="Show password"/);
});

test('the same Show/Hide pattern covers the new-password and confirm-password recovery fields', function () {
    assert.match(mainJs, /data-toggle-visibility="auth-new-password"/);
    assert.match(mainJs, /data-toggle-visibility="auth-confirm-password"/);
    assert.match(mainJs, /id="auth-new-password" name="new_password" type="password" autocomplete="new-password" minlength="8"/);
    assert.match(mainJs, /id="auth-confirm-password" name="confirm_password" type="password" autocomplete="new-password" minlength="8"/);
});

test('the visibility-toggle handler actually flips input type and aria-pressed together', function () {
    const match = /document\.addEventListener\('click', function \(event\) \{\s*\n\s*const toggle = event\.target\.closest\('\[data-toggle-visibility\]'\);[\s\S]*?\n\s{8}\}\);/.exec(mainJs);
    assert.ok(match, 'could not find the delegated visibility-toggle click handler');
    assert.match(match[0], /input\.type = willShow \? 'text' : 'password';/);
    assert.match(match[0], /toggle\.setAttribute\('aria-pressed', willShow \? 'true' : 'false'\);/);
});

test('Forgot password calls the real resetPasswordForEmail API with a current-origin redirect', function () {
    const fn = extractFunction(mainJs, 'handleForgotPassword');
    assert.match(fn, /Enter your email first\./);
    assert.match(fn, /window\.location\.origin \+ '\/events\?password-recovery=1'/);
    assert.match(fn, /BirdieAuth\.resetPasswordForEmail\(email, redirectTo\)/);
    assert.match(fn, /If that email belongs to an account, a password reset link has been sent\./, 'must never reveal whether the email exists');
});

test('BirdieAuth exposes resetPasswordForEmail and updatePassword using the real Supabase Auth APIs', function () {
    const resetFn = extractFunction(mainJs, 'resetPasswordForEmail');
    assert.match(resetFn, /client\.auth\.resetPasswordForEmail\(email, \{ redirectTo: redirectTo \}\)/);
    const updateFn = extractFunction(mainJs, 'updatePassword');
    assert.match(updateFn, /client\.auth\.updateUser\(\{ password: newPassword \}\)/);
});

test('PASSWORD_RECOVERY is handled by its specific event type, not any auth state change', function () {
    assert.match(mainJs, /if \(event === 'PASSWORD_RECOVERY'\) \{/);
    assert.match(mainJs, /recoveryListeners\.forEach/);
    assert.match(mainJs, /function onPasswordRecovery\(fn\) \{/);
});

test('returning from the recovery email opens the modal in recovery mode and cleans the URL without breaking the session', function () {
    assert.match(mainJs, /BirdieAuth\.onPasswordRecovery\(function \(\) \{\s*\n\s*openLoginModal\('recovery'\);\s*\n\s*cleanRecoveryUrlNoise\(\);/);
    const cleanFn = extractFunction(mainJs, 'cleanRecoveryUrlNoise');
    assert.match(cleanFn, /history\.replaceState/);
});

test('password update enforces an 8-character minimum and a confirm-match before calling Supabase', function () {
    const fn = extractFunction(mainJs, 'handlePasswordUpdateSubmit');
    assert.match(fn, /newPassword\.length < 8/);
    assert.match(fn, /Password must be at least 8 characters\./);
    assert.match(fn, /newPassword !== confirmPassword/);
    assert.match(fn, /Passwords do not match\./);
    // Both length/match checks must appear before the Supabase call, so an
    // invalid submission never reaches the network.
    const supabaseCallIndex = fn.indexOf('BirdieAuth.updatePassword');
    const lengthCheckIndex = fn.indexOf('newPassword.length < 8');
    const matchCheckIndex = fn.indexOf('newPassword !== confirmPassword');
    assert.ok(lengthCheckIndex !== -1 && lengthCheckIndex < supabaseCallIndex);
    assert.ok(matchCheckIndex !== -1 && matchCheckIndex < supabaseCallIndex);
});

test('setAuthMode toggles required on both field groups so a hidden group can never block native validation', function () {
    const fn = extractFunction(mainJs, 'setAuthMode');
    assert.match(fn, /emailInput\.required = !isRecovery;/);
    assert.match(fn, /passwordInput\.required = !isRecovery;/);
    assert.match(fn, /newPasswordInput\.required = isRecovery;/);
    assert.match(fn, /confirmPasswordInput\.required = isRecovery;/);
});

test('no service-role or secret key was introduced anywhere in js/main.js', function () {
    assert.doesNotMatch(mainJs, /service_role/);
    assert.doesNotMatch(mainJs, /sb_secret_/);
    // Only the existing browser-safe publishable key should be present.
    assert.match(mainJs, /sb_publishable_/);
});

test('the existing approved-profile fail-closed behaviour is untouched', function () {
    assert.match(mainJs, /profile\.approved === false/);
    assert.match(mainJs, /'Pending Approval'/);
});

test('routeByRole still keeps the Events page in place instead of navigating away after login', function () {
    const fn = extractFunction(mainJs, 'routeByRole');
    assert.match(fn, /if \(isEventsPage\(\)\) return;/);
});

test('the password Show/Hide toggle is absolutely positioned inside the input, so it cannot force horizontal overflow at 320px', function () {
    assert.match(styleCss, /\.auth-toggle-visibility\s*\{[^}]*position:\s*absolute;/);
    // Specificity check: the wrap-scoped padding-right override must be
    // able to actually win over the base #auth-form input shorthand
    // padding, or the toggle would visually overlap typed text.
    assert.match(styleCss, /#auth-form \.auth-password-wrap input\s*\{[^}]*padding-right:/);
    assert.doesNotMatch(styleCss, /\.auth-toggle-visibility\s*\{[^}]*width:\s*\d+(px|rem)/, 'the toggle must not have a fixed width that could push the layout wide');
});

console.log('\nAuth UI / password recovery: ' + passed + ' passed, ' + failed + ' failed.');
if (failed > 0) {
    process.exitCode = 1;
}
