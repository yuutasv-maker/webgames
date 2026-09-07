<?php
/**
 * Plugin Name: OWL Pick Up Live Shortcode
 * Description: The Events Calendarの注目イベント（Featured Events）を取得して表示するための無料版向けカスタムショートコード `[owl_pickup_live]` を追加します。
 * Version: 1.1
 * Author: Antigravity
 */

if (!defined('ABSPATH')) {
    exit;
}

function owl_pickup_live_shortcode($atts)
{
    // 属性のデフォルト値を設定（表示件数など）
    $a = shortcode_atts(array(
        'limit' => 3, // デフォルト3件表示
    ), $atts);

    // limitの値を取得・数値化（もし-1など全件表示指定があればそれも許容するためintvalのまま）
    $posts_per_page = intval($a['limit']);

    // wp_queryを使って The Events Calendar のFeaturedイベントを取得
    $args = array(
        'post_type' => 'tribe_events',
        'posts_per_page' => $posts_per_page,
        'post_status' => 'publish',
        'meta_query' => array(
            'relation' => 'AND',
            array(
                'key' => '_tribe_featured', // The Events CalendarのFeaturedフラグ
                'value' => '1',
                'compare' => '='
            ),
            array(
                'key' => '_EventStartDate', // 終了したイベントを出さないために日付でフィルタ
                'value' => date('Y-m-d H:i:s'),
                'compare' => '>=',
                'type' => 'DATETIME'
            )
        ),
        'meta_key' => '_EventStartDate',
        'orderby' => 'meta_value',
        'order' => 'ASC', // 今から近い順に表示
    );

    $query = new WP_Query($args);

    ob_start();

    // イベントがある場合
    if ($query->have_posts()) {
        echo '<div class="owl-pickup-events">';

        while ($query->have_posts()) {
            $query->the_post();

            // イベント情報取得
            $event_id = get_the_ID();
            $event_title = get_the_title();
            $event_url = get_permalink();

            // The Events Calendarの関数を使って成形された日付を取得
            $event_date = tribe_get_start_date($event_id, false, 'Y年m月d日');

            // アイキャッチ画像（フライヤー）の取得
            if (has_post_thumbnail()) {
                // 'medium' はWPの標準サイズ, テーマなどに合わせて要調整
                $thumbnail = get_the_post_thumbnail($event_id, 'medium', array('class' => 'pickup-event-image', 'style' => 'max-width: 100%; height: auto;'));
            } else {
                // 画像がない場合のプレースホルダー（必要に応じて）
                $thumbnail = '<div class="pickup-no-image" style="background:#eee; padding:20px; text-align:center;">No Image</div>';
            }

            // HTMLの出力組み立て
            ?>
            <div class="pickup-event-item" style="margin-bottom: 30px;">
                <a href="<?php echo esc_url($event_url); ?>" style="text-decoration: none; color: inherit;">
                    <div class="pickup-image-wrapper">
                        <?php echo $thumbnail; ?>
                    </div>
                    <div class="pickup-title-wrapper" style="margin-top: 10px; font-weight: bold;">
                        <?php echo esc_html($event_date); ?><br>
                        <?php echo esc_html($event_title); ?>
                    </div>
                </a>
            </div>
            <?php
        }

        echo '</div>';
    } else {
        echo '<p>現在、注目のPick Up Live!はありません。</p>';
    }

    wp_reset_postdata();

    return ob_get_clean();
}

/**
 * [owl_pickup_live limit="3"] でショートコードを登録
 */
add_shortcode('owl_pickup_live', 'owl_pickup_live_shortcode');

/**
 * 定期イベントの次回開催日を表示するためのショートコード
 * 使用例: [owl_next_event title="フリーライブ"]
 * タイトルは部分一致で検索されます。
 */
function owl_next_event_shortcode($atts)
{
    // 属性のデフォルト値を設定
    $a = shortcode_atts(array(
        'title' => '', // 検索するイベントタイトル
    ), $atts);

    $target_title = trim($a['title']);

    if (empty($target_title)) {
        return '<p class="owl-next-event-error" style="color: red;">[owl_next_event] エラー: イベントタイトルが指定されていません。</p>';
    }

    // WP_Queryを使ってThe Events Calendarのイベントを取得
    // 注意: 'title' パラメータはWordPress内部で完全一致条件を生成するため使用しない
    // 代わりにカスタム変数 'owl_title_search' で検索語を渡す
    $args = array(
        'post_type' => 'tribe_events',
        'posts_per_page' => 1,
        'post_status' => 'publish',
        'owl_title_search' => $target_title,
        'meta_query' => array(
            array(
                'key' => '_EventStartDate',
                'value' => current_time('mysql'),
                'compare' => '>=',
                'type' => 'DATETIME'
            )
        ),
        'meta_key' => '_EventStartDate',
        'orderby' => 'meta_value',
        'order' => 'ASC',
    );

    // カスタムフィルターを追加（部分一致検索用）
    add_filter('posts_where', 'owl_title_search_filter', 10, 2);

    $query = new WP_Query($args);

    // フィルターの削除（他のクエリに影響を与えないように）
    remove_filter('posts_where', 'owl_title_search_filter', 10);

    ob_start();

    // イベントがある場合
    if ($query->have_posts()) {
        $query->the_post();

        $event_id = get_the_ID();
        $event_url = get_permalink();

        // The Events Calendarの関数を使って成形された日付と時間を取得
        $event_date = tribe_get_start_date($event_id, false, 'Y年m月d日');
        $event_time = tribe_get_start_date($event_id, false, 'H:i');

        // 曜日の取得
        $week_num = tribe_get_start_date($event_id, false, 'w');
        $week_jp = array('日', '月', '火', '水', '木', '金', '土');
        $event_dayOfWeek = $week_jp[$week_num];

        ?>
        <div class="owl-next-event-info"
            style="margin: 20px 0; padding: 15px; border-left: 5px solid #ff7f50; background-color: #fcfcfc;">
            <p style="margin: 0; font-size: 1.1em; font-weight: bold;">
                <span class="owl-next-event-label"
                    style="display:inline-block; background-color: #ff7f50; color: #fff; padding: 2px 10px; border-radius: 3px; font-size: 0.8em; vertical-align: middle; margin-right: 10px; margin-bottom: 3px;">次回開催日</span>
                <a href="<?php echo esc_url($event_url); ?>" style="text-decoration: none; color: #333;">
                    <?php echo esc_html($event_date); ?>(<?php echo esc_html($event_dayOfWeek); ?>)
                    <?php echo esc_html($event_time); ?>〜
                </a>
            </p>
        </div>
        <?php
    } else {
        // 現在以降のスケジュールが見つからない場合
        ?>
        <div class="owl-next-event-info"
            style="margin: 20px 0; padding: 15px; border-left: 5px solid #ccc; background-color: #f9f9f9;">
            <p style="margin: 0;">イベントの次回開催日は未定です。（スケジュールが決定次第更新されます）</p>
        </div>
        <?php
    }

    wp_reset_postdata();

    return ob_get_clean();
}

/**
 * WP_Query の title 検索を部分一致（LIKE '%keyword%'）にするためのヘルパー関数
 * カスタム変数 'owl_title_search' から検索語を取得する
 * 検索語はそのまま部分一致で検索される（タイトルのどこかに含まれていればヒット）
 */
function owl_title_search_filter($where, $wp_query)
{
    global $wpdb;
    $search_term = $wp_query->get('owl_title_search');
    if (!empty($search_term)) {
        $where .= ' AND ' . $wpdb->posts . ".post_title LIKE '%" . esc_sql($wpdb->esc_like($search_term)) . "%'";
    }
    return $where;
}

add_shortcode('owl_next_event', 'owl_next_event_shortcode');
