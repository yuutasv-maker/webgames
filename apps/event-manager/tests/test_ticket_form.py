import os
import re

def test_ticket_form_ignore_logic():
    """
    フロントエンドのJS (ticket_form.html) において、
    「プレイガイド」や「eplus.jp」を含むイベントを除外するロジックが組み込まれているかを検証します。
    """
    template_path = os.path.join(
        os.path.dirname(__file__), 
        '../templates/ticket_form.html'
    )
    
    with open(template_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 必須のキーワード配列が定義されているか
    assert "ignoreKeywords" in content
    assert "eplus.jp" in content
    assert "プレイガイド" in content
    
    # フィルタリングロジックが正しく含まれているか
    assert "data.events.filter" in content
    assert "JSON.stringify" in content
    
    # evString.includes(kw) もしくはそれに準ずるチェックが含まれているか
    assert re.search(r"includes\(kw\)", content) is not None, "JSのフィルタリング内でincludes(kw)が使用されていません"
    assert re.search(r"some\(kw\s*=>", content) is not None, "JSのフィルタリング内でsome()による判定が使用されていません"
