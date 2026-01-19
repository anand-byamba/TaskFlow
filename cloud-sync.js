// ============================================
// CLOUD SYNC - Secure Access Code System
// ============================================

class CloudSync {
    constructor(supabaseUrl, supabaseKey) {
        this.supabaseUrl = supabaseUrl;
        this.supabaseKey = supabaseKey;
        this.accessCode = localStorage.getItem('taskflow-access-code');
        this.syncEnabled = false;
    }

    // ============================================
    // API HELPERS
    // ============================================
    async query(table, options = {}) {
        let url = `${this.supabaseUrl}/rest/v1/${table}`;
        const params = new URLSearchParams();

        if (options.select) params.append('select', options.select);
        if (options.filter) {
            for (const [key, value] of Object.entries(options.filter)) {
                params.append(key, value);
            }
        }

        const queryString = params.toString();
        if (queryString) url += `?${queryString}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'apikey': this.supabaseKey,
                'Authorization': `Bearer ${this.supabaseKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error(`Query failed: ${response.status}`);
        return response.json();
    }

    async insert(table, data) {
        const url = `${this.supabaseUrl}/rest/v1/${table}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'apikey': this.supabaseKey,
                'Authorization': `Bearer ${this.supabaseKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) throw new Error(`Insert failed: ${response.status}`);
        return response.json();
    }

    async update(table, filter, data) {
        let url = `${this.supabaseUrl}/rest/v1/${table}`;
        const params = new URLSearchParams();

        for (const [key, value] of Object.entries(filter)) {
            params.append(key, value);
        }
        url += `?${params.toString()}`;

        const response = await fetch(url, {
            method: 'PATCH',
            headers: {
                'apikey': this.supabaseKey,
                'Authorization': `Bearer ${this.supabaseKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) throw new Error(`Update failed: ${response.status}`);
        return response.json();
    }

    // ============================================
    // ACCESS CODE GENERATION
    // ============================================
    generateCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1 to avoid confusion
        const segments = [];

        for (let s = 0; s < 3; s++) {
            let segment = '';
            for (let i = 0; i < 4; i++) {
                segment += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            segments.push(segment);
        }

        return segments.join('-');
    }

    // ============================================
    // PIN HASHING (Simple hash for demo - use bcrypt in production)
    // ============================================
    async hashPin(pin) {
        const encoder = new TextEncoder();
        const data = encoder.encode(pin + 'taskflow-salt-2026');
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // ============================================
    // RATE LIMITING
    // ============================================
    async checkRateLimit(targetCode) {
        const clientId = await this.getClientIdentifier();

        try {
            const records = await this.query('taskflow_rate_limits', {
                filter: {
                    'ip_address': `eq.${clientId}`,
                    'target_code': `eq.${targetCode}`
                }
            });

            if (records.length > 0) {
                const record = records[0];

                // Check if blocked
                if (record.blocked_until) {
                    const blockedUntil = new Date(record.blocked_until);
                    if (blockedUntil > new Date()) {
                        const hoursLeft = Math.ceil((blockedUntil - new Date()) / (1000 * 60 * 60));
                        return { blocked: true, hoursLeft };
                    }
                }

                // Check attempts
                if (record.attempts >= 5) {
                    // Block for 24 hours
                    const blockedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
                    await this.update('taskflow_rate_limits',
                        { 'ip_address': `eq.${clientId}`, 'target_code': `eq.${targetCode}` },
                        { blocked_until: blockedUntil.toISOString() }
                    );

                    // Rotate the targeted user's code
                    await this.rotateCodeForUser(targetCode);

                    return { blocked: true, hoursLeft: 24, codeRotated: true };
                }
            }

            return { blocked: false };
        } catch (error) {
            console.error('Rate limit check failed:', error);
            return { blocked: false };
        }
    }

    async recordFailedAttempt(targetCode) {
        const clientId = await this.getClientIdentifier();

        try {
            const records = await this.query('taskflow_rate_limits', {
                filter: {
                    'ip_address': `eq.${clientId}`,
                    'target_code': `eq.${targetCode}`
                }
            });

            if (records.length > 0) {
                await this.update('taskflow_rate_limits',
                    { 'ip_address': `eq.${clientId}`, 'target_code': `eq.${targetCode}` },
                    { attempts: records[0].attempts + 1 }
                );
            } else {
                await this.insert('taskflow_rate_limits', {
                    ip_address: clientId,
                    target_code: targetCode,
                    attempts: 1
                });
            }
        } catch (error) {
            console.error('Failed to record attempt:', error);
        }
    }

    async clearRateLimit(targetCode) {
        const clientId = await this.getClientIdentifier();

        try {
            const url = `${this.supabaseUrl}/rest/v1/taskflow_rate_limits?ip_address=eq.${clientId}&target_code=eq.${targetCode}`;
            await fetch(url, {
                method: 'DELETE',
                headers: {
                    'apikey': this.supabaseKey,
                    'Authorization': `Bearer ${this.supabaseKey}`
                }
            });
        } catch (error) {
            console.error('Failed to clear rate limit:', error);
        }
    }

    async getClientIdentifier() {
        // Simple fingerprint based on available browser info
        const data = [
            navigator.userAgent,
            navigator.language,
            screen.width,
            screen.height,
            new Date().getTimezoneOffset()
        ].join('|');

        const encoder = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // ============================================
    // CODE ROTATION
    // ============================================
    async rotateCodeForUser(oldCode) {
        try {
            const newCode = this.generateCode();
            await this.update('taskflow_users',
                { 'access_code': `eq.${oldCode}` },
                {
                    access_code: newCode,
                    previous_code: oldCode,
                    code_rotated_at: new Date().toISOString()
                }
            );
            return newCode;
        } catch (error) {
            console.error('Code rotation failed:', error);
            return null;
        }
    }

    // ============================================
    // USER OPERATIONS
    // ============================================
    async createUser() {
        const code = this.generateCode();

        try {
            await this.insert('taskflow_users', {
                access_code: code,
                tasks: []
            });

            this.accessCode = code;
            localStorage.setItem('taskflow-access-code', code);
            this.syncEnabled = true;

            return { success: true, code };
        } catch (error) {
            console.error('Failed to create user:', error);
            return { success: false, error: error.message };
        }
    }

    async validateCode(code, pin = null) {
        // Check rate limit first
        const rateLimit = await this.checkRateLimit(code);
        if (rateLimit.blocked) {
            return {
                success: false,
                error: `Too many attempts. Try again in ${rateLimit.hoursLeft} hours.`,
                blocked: true
            };
        }

        try {
            const users = await this.query('taskflow_users', {
                filter: { 'access_code': `eq.${code}` }
            });

            if (users.length === 0) {
                // Check if this was a rotated code
                const rotatedUsers = await this.query('taskflow_users', {
                    filter: { 'previous_code': `eq.${code}` }
                });

                if (rotatedUsers.length > 0) {
                    return {
                        success: false,
                        error: 'This code was changed for security reasons. Check your email or try your new code.',
                        codeRotated: true,
                        newCode: rotatedUsers[0].access_code
                    };
                }

                await this.recordFailedAttempt(code);
                return { success: false, error: 'Invalid access code' };
            }

            const user = users[0];

            // Check PIN if set
            if (user.pin_hash && pin) {
                const pinHash = await this.hashPin(pin);
                if (pinHash !== user.pin_hash) {
                    await this.recordFailedAttempt(code);
                    return { success: false, error: 'Invalid PIN' };
                }
            } else if (user.pin_hash && !pin) {
                return { success: false, error: 'PIN required', pinRequired: true };
            }

            // Success - clear rate limits
            await this.clearRateLimit(code);

            this.accessCode = code;
            localStorage.setItem('taskflow-access-code', code);
            this.syncEnabled = true;

            return {
                success: true,
                tasks: user.tasks || [],
                hasPin: !!user.pin_hash,
                hasEmail: !!user.email
            };
        } catch (error) {
            console.error('Validation failed:', error);
            return { success: false, error: 'Connection error. Please try again.' };
        }
    }

    async syncTasks(tasks) {
        if (!this.syncEnabled || !this.accessCode) return false;

        try {
            await this.update('taskflow_users',
                { 'access_code': `eq.${this.accessCode}` },
                { tasks }
            );
            return true;
        } catch (error) {
            console.error('Sync failed:', error);
            return false;
        }
    }

    async setPin(pin) {
        if (!this.accessCode) return false;

        try {
            const pinHash = await this.hashPin(pin);
            await this.update('taskflow_users',
                { 'access_code': `eq.${this.accessCode}` },
                { pin_hash: pinHash }
            );
            return true;
        } catch (error) {
            console.error('Failed to set PIN:', error);
            return false;
        }
    }

    async removePin() {
        if (!this.accessCode) return false;

        try {
            await this.update('taskflow_users',
                { 'access_code': `eq.${this.accessCode}` },
                { pin_hash: null }
            );
            return true;
        } catch (error) {
            console.error('Failed to remove PIN:', error);
            return false;
        }
    }

    async setEmail(email) {
        if (!this.accessCode) return false;

        try {
            await this.update('taskflow_users',
                { 'access_code': `eq.${this.accessCode}` },
                { email }
            );
            return true;
        } catch (error) {
            console.error('Failed to set email:', error);
            return false;
        }
    }

    // Auto-load if code exists
    async autoLoad() {
        if (!this.accessCode) return null;

        const result = await this.validateCode(this.accessCode);
        if (result.pinRequired) {
            return { needsPin: true };
        }
        return result;
    }

    logout() {
        this.accessCode = null;
        this.syncEnabled = false;
        localStorage.removeItem('taskflow-access-code');
    }

    getAccessCode() {
        return this.accessCode;
    }

    isEnabled() {
        return this.syncEnabled;
    }
}
