<?php
declare(strict_types=1);

namespace App;

/**
 * Read the shared EVOL portal PHP session for ZCOST UI gates.
 */
class PortalAuth
{
    /** Only these usernames may see / use the Approve button. */
    public const APPROVE_USERNAMES = ['admin', 'nandhakumar'];

    public static function boot(): void
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            @session_start();
        }
    }

    public static function canApprove(?string $username = null): bool
    {
        $key = strtolower(trim((string)($username ?? self::currentUser()['username'])));
        return in_array($key, self::APPROVE_USERNAMES, true);
    }

    /**
     * @return array{logged_in:bool,is_admin:bool,can_approve:bool,username:string,role:string,display_name:string,email:string}
     */
    public static function currentUser(): array
    {
        self::boot();

        $username = trim((string)(
            $_SESSION['username']
            ?? $_SESSION['user']
            ?? $_SESSION['user_name']
            ?? ''
        ));
        $role = strtolower(trim((string)($_SESSION['role'] ?? '')));
        $userId = (int)($_SESSION['user_id'] ?? 0);

        // Mirror portal_bootstrap admin overrides for live portal accounts.
        $userKey = strtolower($username);
        if (in_array($userKey, ['admin', 'nga'], true)) {
            $role = 'admin';
        } elseif ($userKey === 'it_admin') {
            $role = 'it_admin';
        }

        $loggedIn = $userId > 0 || $username !== '';
        $isAdmin = $loggedIn && $role === 'admin';
        $canApprove = $loggedIn && self::canApprove($username);

        $display = trim((string)(
            $_SESSION['full_name']
            ?? $_SESSION['name']
            ?? $_SESSION['display_name']
            ?? ''
        ));
        if ($display === '') {
            $display = $username !== '' ? $username : 'Guest';
        }

        $email = trim((string)($_SESSION['email'] ?? ''));
        if ($email === '' && $username !== '') {
            $email = $username . '@evolvclothing.com';
        }

        return [
            'logged_in' => $loggedIn,
            'is_admin' => $isAdmin,
            'can_approve' => $canApprove,
            'username' => $username !== '' ? $username : 'Guest',
            'role' => $role !== '' ? $role : 'guest',
            'display_name' => $display,
            'email' => $email !== '' ? $email : 'guest@evolvclothing.com',
        ];
    }

    public static function isLiveAdmin(): bool
    {
        return self::currentUser()['is_admin'] === true;
    }

    public static function requireLiveAdmin(): void
    {
        if (self::isLiveAdmin()) {
            return;
        }
        http_response_code(403);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'success' => false,
            'error' => 'Audit Log is available only for live admin logins.',
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        exit;
    }
}
