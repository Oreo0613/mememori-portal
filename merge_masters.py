import json
import csv
import os
import sys

def merge_data():
    characters = []
    
    # 📁 3つの外付けCSVファイルの存在チェック
    required_files = ["chara_base.csv", "weapon.csv", "skill.csv"]
    for file in required_files:
        if not os.path.exists(file):
            print(f"❌ エラー: ファイル {file} が見つかりません！")
            print(f"フォルダ内に配置されているか確認してください。")
            return
            
    print("⏳ [1/4] 3つのCSVファイルを読み込んでいます...")

    # 1. キャラクター基本マスタの読み込み
    try:
        with open("chara_base.csv", "r", encoding="utf-8-sig", errors="ignore") as f:
            reader_base = csv.DictReader(f)
            # ヘッダーチェック
            if not reader_base.fieldnames:
                print("❌ エラー: chara_base.csv の中身が空っぽ、またはヘッダーがありません。")
                return
            if "ID" not in reader_base.fieldnames:
                print(f"❌ エラー: chara_base.csv に 'ID' 列がありません。現在の列: {reader_base.fieldnames}")
                return
                
            for row in reader_base:
                if not row.get("ID"): continue
                cid = row["ID"].strip()
                char_node = {
                    "id": cid,
                    "name": row.get("キャラクター名", "").strip(),
                    "attr": row.get("属性", "").strip(),
                    "type": row.get("タイプ", "").strip(),
                    "rarity": row.get("恒常/限定", "").strip(),
                    "releaseDate": row.get("実装日", "").replace("/", "-").strip(),
                    "iconUrl": f"assets/images/chara-icon/{cid}.webp",
                    "updatedAt": row.get("更新日時", "").strip(),
                    "status": {
                        "str": row.get("腕力", "").strip(),
                        "dex": row.get("技力", "").strip(),
                        "mag": row.get("魔力", "").strip(),
                        "sta": row.get("耐久力", "").strip(),
                        "speed": row.get("スピード", "").strip(),
                        "defInitial": row.get("防御力", "").strip(),
                        "penCustom": row.get("物魔防御貫通", "").strip()
                    },
                    "tags": row.get("タグ", "").strip().replace("[完了]", "").replace(" ,", "").replace(", ", "").strip(", "),
                    "isFinished": "TRUE" if "[完了]" in row.get("タグ", "") else "FALSE",
                    "weapon": {
                        "name": "",
                        "astaroth": {"stat": "", "passive1": "", "passive2": "", "passive3": ""},
                        "michael": {"stat": "", "passive1": "", "passive2": "", "passive3": ""},
                        "metatron": {"stat": "", "passive1": "", "passive2": "", "passive3": ""}
                    },
                    "skills": []
                }
                characters.append(char_node)
        print(f"✅ 基本マスタ読み込み完了: {len(characters)} 件")
    except Exception as e:
        print(f"❌ 基本マスタ (chara_base.csv) の読み込み中にエラー発生:\n{e}")
        return

    # 2. 専用武器データのマージ
    print("⏳ [2/4] 専用武器マスタを合体中...")
    try:
        with open("weapon.csv", "r", encoding="utf-8-sig", errors="ignore") as f:
            reader_wpn = csv.DictReader(f)
            for row in reader_wpn:
                if not row.get("キャラクターID"): continue
                cid = row["キャラクターID"].strip()
                for c in characters:
                    if c["id"] == cid:
                        c["weapon"]["name"] = row.get("専用武器名", "").strip()
                        c["weapon"]["astaroth"] = {
                            "stat": row.get("アスタロト固有値", "").strip(),
                            "passive1": row.get("アスタロトパッシブ1", "").strip(),
                            "passive2": row.get("アスタロトパッシブ2", "").strip(),
                            "passive3": row.get("アスタロトパッシブ3", "").strip()
                        }
                        c["weapon"]["michael"] = {
                            "stat": row.get("ミカエル固有値", "").strip(),
                            "passive1": row.get("ミカエルパッシブ1", "").strip(),
                            "passive2": row.get("ミカエルパッシブ2", "").strip(),
                            "passive3": row.get("ミカエルパッシブ3", "").strip()
                        }
                        c["weapon"]["metatron"] = {
                            "stat": row.get("メタトロン固有値", "").strip(),
                            "passive1": row.get("メタトロンパッシブ1", "").strip(),
                            "passive2": row.get("メタトロンパッシブ2", "").strip(),
                            "passive3": row.get("メタトロンパッシブ3", "").strip()
                        }
        print("✅ 専用武器マスタの合体完了")
    except Exception as e:
        print(f"❌ 専用武器マスタ (weapon.csv) の合体中にエラー発生:\n{e}")
        return
    # 3. スキルデータのマージ
    print("⏳ [3/4] スキルマスタを合体中...")
    try:
        with open("skill.csv", "r", encoding="utf-8-sig", errors="ignore") as f:
            reader_skl = csv.DictReader(f)
            for row in reader_skl:
                if not row or not row.get("キャラクターID") or not row.get("スキル種別"): 
                    continue
                cid = row["キャラクターID"].strip()
                for c in characters:
                    if c["id"] == cid:
                        ct_val = row.get("CT", "").strip()
                        skill_node = {
                            "type": row.get("スキル種別", "").strip(),
                            "name": row.get("スキル名", "").strip(),
                            "ct": int(ct_val) if ct_val.isdigit() else None,
                            "nomalText": row.get("通常武器スキル内容", "").strip().replace('\r\n', '\n').replace('\r', '\n'),
                            "astarothText": row.get("アスタロトスキル内容", "").strip().replace('\r\n', '\n').replace('\r', '\n'),
                            "michaelText": row.get("ミカエルスキル内容", "").strip().replace('\r\n', '\n').replace('\r', '\n'),
                            "metatronText": row.get("メタトロンスキル内容", "").strip().replace('\r\n', '\n').replace('\r', '\n')
                        }
                        c["skills"].append(skill_node)
        print("✅ スキルマスタの合体完了")
    except Exception as e:
        print(f"❌ スキルマスタ (skill.csv) の合体中にエラー発生:\n{e}")
        return
    

    # =========================================================================
    # ✨ 【ここが直後！】5つ目の引き出し「専用武器効果 (WP)」の空枠を自動生成
    # =========================================================================
    print("🔮 [3.5/4] 専用武器効果 (WP) の真っ新な空枠をスキル一覧の末尾に追加中...")
    try:
        # すべてのキャラクター（135人分）に対して、一律で空欄の5つ目のスキルを追加します
        for c in characters:
            wp_node = {
                "type": "WP", 
                "name": "専用武器効果", 
                "ct": None,
                "nomalText": "",     # ⭕️ すべて綺麗に空欄（空文字）にします
                "astarothText": "",  # ⭕️ すべて綺麗に空欄（空文字）にします
                "michaelText": "",   # ⭕️ すべて綺麗に空欄（空文字）にします
                "metatronText": ""   # ⭕️ すべて綺麗に空欄（空文字）にします
            }
            c["skills"].append(wp_node)
        print("✅ 専用武器効果 (WP) の空枠追加完了")
    except Exception as e:
        print(f"❌ 専用武器効果 (WP) の枠生成中にエラー発生:\n{e}")
        return
    # 4. JSONとして書き出し
    print("⏳ [4/4] 統合JSONファイルを書き出し中...")
    try:
        characters.sort(key=lambda x: int(x["id"]), reverse=True)
        with open("character-master.json", "w", encoding="utf-8") as f:
            json.dump(characters, f, ensure_ascii=False, indent=4)
        
        print("\n🔮 【大成功】1つの統合JSONが美しく生成されました！")
        print("📁 生成されたファイル: character-master.json")
    except Exception as e:
        print(f"❌ JSONファイル書き出し中にエラー発生:\n{e}")

if __name__ == "__main__":
    merge_data()
