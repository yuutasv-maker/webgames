<?php
/**
 * Plugin Name: Owl Auth Fix
 * Plugin URI: https://owl21.info/
 * Description: ロリポップなどのCGIモードサーバー環境において、REST APIのBasic認証（Application Passwords）が弾かれる問題を、独自ヘッダー(X-Owl-Auth)を利用して確実に回避する専用プラグインです。
 * Version: 1.0.0
 * Author: Antigravity
 * Author URI: 
 * License: GPL2
 */

defined( 'ABSPATH' ) || exit;

// REST APIの認証判定が実行される前に、独自のX-Owl-Authヘッダーから認証情報を取り出し環境変数にセットする
add_filter('determine_current_user', function($user) {
    if ( ! empty( $_SERVER['HTTP_X_OWL_AUTH'] ) ) {
        $header = $_SERVER['HTTP_X_OWL_AUTH'];
        if ( strpos( $header, 'Basic ' ) === 0 ) {
            $decoded = base64_decode( substr( $header, 6 ) );
            if ( $decoded && strpos( $decoded, ':' ) !== false ) {
                list( $username, $password ) = explode( ':', $decoded, 2 );
                $_SERVER['PHP_AUTH_USER'] = $username;
                $_SERVER['PHP_AUTH_PW']   = $password;
            }
        }
    }
    return $user;
}, 1);
