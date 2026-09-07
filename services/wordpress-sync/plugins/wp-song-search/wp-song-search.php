<?php
/**
 * Plugin Name: 生オケ！楽曲検索システム (Owl Song Search)
 * Description: Googleスプレッドシートと連動して動く高速な楽曲検索システム。ショートコード [song_search] で表示できます。
 * Version: 1.0.0
 * Author: Antigravity
 * Text Domain: owl-song-search
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}

class OwlSongSearchPlugin {

	public function __construct() {
		// ショートコードの登録
		add_shortcode( 'song_search', array( $this, 'render_shortcode' ) );
		// スクリプトとスタイルの登録（ショートコードが呼ばれた時だけ出力するため、ここでは登録のみ）
		add_action( 'wp_enqueue_scripts', array( $this, 'register_assets' ) );
	}

	public function register_assets() {
		// CSSの登録
		wp_register_style(
			'owl-song-search-style',
			plugin_dir_url( __FILE__ ) . 'assets/css/song-search.css',
			array(),
			'1.0.0'
		);

		// ロジックJSの登録
		wp_register_script(
			'owl-song-search-logic',
			plugin_dir_url( __FILE__ ) . 'assets/js/song-search-logic.js',
			array(),
			'1.0.0',
			true // </body>直前に出力
		);

		// UI JSの登録
		wp_register_script(
			'owl-song-search-ui',
			plugin_dir_url( __FILE__ ) . 'assets/js/song-search-ui.js',
			array( 'owl-song-search-logic' ), // logicに依存
			'1.0.0',
			true
		);
	}

	public function render_shortcode( $atts ) {
		// ショートコードの属性を取得し、デフォルト値を設定
		$a = shortcode_atts( array(
			'csv_url'  => '', // デフォルトは空（エラー表示用）
			'per_page' => 30, // デフォルト30件
		), $atts );

		// 必要なアセットを読み込み
		wp_enqueue_style( 'owl-song-search-style' );
		wp_enqueue_script( 'owl-song-search-logic' );
		wp_enqueue_script( 'owl-song-search-ui' );

		// CSV URLをカンマ区切りで複数指定可能にする
		$raw_urls = explode( ',', $a['csv_url'] );
		$clean_urls = array();
		foreach ( $raw_urls as $url ) {
			$u = trim( $url );
			if ( ! empty( $u ) ) {
				$clean_urls[] = esc_url_raw( $u );
			}
		}

		// JavaScriptにPHP側の設定（URLの配列と件数）を渡す
		wp_localize_script( 'owl-song-search-ui', 'OwlSongSearchConfig', array(
			'csvUrls'      => $clean_urls,
			'itemsPerPage' => absint( $a['per_page'] ),
		) );

		// HTMLを出力（バッファリングを使用）
		ob_start();
		?>
		<div id="song-search-app">
			<!-- ヘッダーバナー -->
			<div class="ssa-header">
				<h1>曲リスト検索</h1>
			</div>
			<hr class="ssa-divider">

			<!-- ステータス表示（ローディング等） -->
			<div id="ssa-status-area"></div>

			<!-- 検索エリア -->
			<div class="ssa-search-area">
				<div class="ssa-search-input-wrap">
					<input
						type="text"
						id="ssa-search-input"
						class="ssa-search-input"
						placeholder="曲名・アーティスト名で検索"
						autocomplete="off"
					>
				</div>
			</div>

			<!-- フィルター群（折りたたみ式） -->
			<details class="ssa-filter-accordion">
				<summary class="ssa-filter-summary">🔽 詳細な条件で絞り込む</summary>
				<div class="ssa-filter-accordion-content">

					<!-- フィルター: 曲名（あかさたな） -->
					<div class="ssa-filter-section">
						<span class="ssa-filter-label">曲名（あかさたな）</span>
						<div id="ssa-title-kana-buttons" class="ssa-filter-buttons"></div>
					</div>

					<!-- フィルター: アーティスト（あかさたな） -->
					<div class="ssa-filter-section">
						<span class="ssa-filter-label">アーティスト（あかさたな）</span>
						<div id="ssa-artist-kana-buttons" class="ssa-filter-buttons"></div>
					</div>

					<!-- フィルター: 年代 -->
					<div class="ssa-filter-section">
						<span class="ssa-filter-label">年代</span>
						<div id="ssa-era-buttons" class="ssa-filter-buttons"></div>
					</div>

					<!-- フィルター: ボーカル -->
					<div class="ssa-filter-section">
						<span class="ssa-filter-label">ボーカル</span>
						<div id="ssa-vocal-buttons" class="ssa-filter-buttons"></div>
					</div>

					<!-- リセットボタン -->
					<div class="ssa-reset-area">
						<button type="button" id="ssa-reset-btn" class="ssa-reset-btn">🔄 条件をリセット</button>
					</div>

				</div>
			</details>

			<hr class="ssa-divider">

			<!-- 結果ヘッダー -->
			<div id="ssa-results-header" class="ssa-results-header">
				検索結果: <span id="ssa-results-count" class="ssa-results-count">0</span> 件
			</div>

			<!-- 曲リスト -->
			<ul id="ssa-song-list" class="ssa-song-list"></ul>

			<!-- ページネーション -->
			<div id="ssa-pagination" class="ssa-pagination"></div>

		</div>
		<?php
		return ob_get_clean();
	}

}

new OwlSongSearchPlugin();
