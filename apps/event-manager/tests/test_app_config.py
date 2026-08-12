import os
import ast

def test_app_host_bind_all_interfaces():
    """
    リファクタリングデグレ防止テスト:
    backend/app.py がデフォルトで 0.0.0.0 (すべてのインターフェース) にバインドされていることを確認する。
    127.0.0.1 に固定されているとスマホ等からアクセスできなくなるため。
    """
    app_py_path = os.path.join(os.path.dirname(__file__), '..', 'app.py')
    
    with open(app_py_path, 'r', encoding='utf-8') as f:
        source_code = f.read()

    # ソースコード内に 127.0.0.1 がハードコードされていないか、
    # または os.environ.get("HOST", "0.0.0.0") になっているかをチェック
    
    # ASTを使って os.environ.get("HOST", "0.0.0.0") を探すのは複雑すぎるため、
    # シンプルに文字列としてチェックする
    assert 'os.environ.get("HOST", "127.0.0.1")' not in source_code, "Host binding regressed to 127.0.0.1. It should be 0.0.0.0 to allow smartphone access."
    assert 'os.environ.get("HOST", "0.0.0.0")' in source_code, "The default host must be 0.0.0.0 for local network access."
