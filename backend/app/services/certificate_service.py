import os
from datetime import datetime
from PIL import Image, ImageDraw, ImageFont


def get_font(size: int, bold: bool = False, serif: bool = False):
    candidates = []
    if serif:
        candidates = [
            "C:/Windows/Fonts/georgiab.ttf" if bold else "C:/Windows/Fonts/georgia.ttf",
            "C:/Windows/Fonts/timesbd.ttf" if bold else "C:/Windows/Fonts/times.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf",
        ]
    else:
        candidates = [
            "C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf",
            "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        ]
    for c in candidates:
        if os.path.exists(c):
            try:
                return ImageFont.truetype(c, size)
            except Exception:
                pass
    try:
        return ImageFont.load_default(size=size)
    except Exception:
        return ImageFont.load_default()


def generate_certificate_document(
    certificate_id: str,
    learner_name: str,
    learner_email: str,
    assessment_title: str,
    score_percentage: float,
    passing_score: float,
    completion_date: datetime,
    template_url: str = None,
) -> str:
    """
    Génère un certificat officiel en haute résolution (2400x1600 px).
    Superpose le contenu sur le template personnalisé si présent, ou génère
    un diplôme d'honneur au design E-Schola Pro Royal Navy & Gold.
    Sauvegarde le fichier dans uploads/certificates/ et renvoie son URL relative.
    """
    # Dossier de persistance des certificats
    cert_dir = os.path.join("uploads", "certificates")
    os.makedirs(cert_dir, exist_ok=True)

    filename = f"{certificate_id}.png"
    file_path = os.path.join(cert_dir, filename)

    width = 2400
    height = 1600

    # Vérification si un template personnalisé existe
    has_custom_template = False
    if template_url:
        clean_path = template_url.lstrip("/")
        if os.path.exists(clean_path):
            try:
                base_img = Image.open(clean_path).convert("RGBA")
                base_img = base_img.resize((width, height), Image.Resampling.LANCZOS)
                img = base_img
                has_custom_template = True
            except Exception as err:
                print(f"[Certificate] Impossible d'ouvrir le template {clean_path}: {err}")

    if not has_custom_template:
        # Création du fond d'honneur blanc perlé
        img = Image.new("RGBA", (width, height), color=(252, 252, 254, 255))
        draw = ImageDraw.Draw(img)

        # Bordure externe Or Décoratif
        gold_color = (197, 160, 89, 255)
        navy_color = (22, 50, 92, 255)
        blue_color = (24, 119, 242, 255)
        slate_text = (71, 85, 105, 255)

        # Double cadre ornementé
        draw.rectangle([(50, 50), (width - 50, height - 50)], outline=navy_color, width=14)
        draw.rectangle([(80, 80), (width - 80, height - 80)], outline=gold_color, width=4)
        draw.rectangle([(95, 95), (width - 95, height - 95)], outline=(226, 232, 240, 255), width=2)

        # Coins ornementés
        corner_len = 70
        for x, y in [(80, 80), (width - 80, 80), (80, height - 80), (width - 80, height - 80)]:
            dx = 1 if x == 80 else -1
            dy = 1 if y == 80 else -1
            draw.line([(x, y), (x + dx * corner_len, y)], fill=gold_color, width=8)
            draw.line([(x, y), (x, y + dy * corner_len)], fill=gold_color, width=8)

        # Ruban Supérieur E-Schola Pro
        draw.rectangle([(width // 2 - 320, 140), (width // 2 + 320, 195)], fill=(239, 246, 255, 255), outline=blue_color, width=2)
        font_brand = get_font(26, bold=True)
        draw.text((width // 2, 167), "E-SCHOLA PRO • ACADÉMIE CERTIFIANTE", fill=blue_color, anchor="mm", font=font_brand)

        # Titre Principal
        font_main_title = get_font(64, bold=True, serif=True)
        draw.text((width // 2, 280), "CERTIFICAT DE RÉUSSITE", fill=navy_color, anchor="mm", font=font_main_title)

        font_sub = get_font(28, bold=False, serif=True)
        draw.text((width // 2, 350), "Ce document officiel atteste avec les honneurs académiques que :", fill=slate_text, anchor="mm", font=font_sub)

        # Nom de l'apprenant mis en majesté
        font_name = get_font(72, bold=True, serif=True)
        display_name = learner_name.strip() if learner_name and learner_name.strip() else learner_email.split('@')[0].capitalize()
        draw.text((width // 2, 470), display_name, fill=blue_color, anchor="mm", font=font_name)

        # Ligne dorée sous le nom
        draw.line([(width // 2 - 450, 530), (width // 2 + 450, 530)], fill=gold_color, width=3)

        # Descriptif de réussite
        font_desc = get_font(30, bold=False)
        draw.text((width // 2, 610), "A satisfait avec distinction à l'ensemble des exigences et épreuves d'évaluation pour :", fill=slate_text, anchor="mm", font=font_desc)

        # Titre de la Certification
        font_cert_title = get_font(52, bold=True, serif=True)
        draw.text((width // 2, 720), f"« {assessment_title} »", fill=navy_color, anchor="mm", font=font_cert_title)

        # Boîte de score et mention
        score_val = round(float(score_percentage), 1)
        mention = "Mention Très Bien" if score_val >= 90 else "Mention Bien" if score_val >= 80 else "Mention Satisfaisant"
        draw.rectangle([(width // 2 - 380, 820), (width // 2 + 380, 910)], fill=(248, 250, 252, 255), outline=(203, 213, 225, 255), width=2)
        font_score = get_font(30, bold=True)
        draw.text((width // 2, 865), f"Score Validé : {score_val}%  •  {mention}", fill=(16, 185, 129, 255), anchor="mm", font=font_score)

        # Date et Identifiant
        date_str = completion_date.strftime("%d %B %Y")
        font_meta = get_font(24, bold=False)
        draw.text((width // 2, 980), f"Délivré le {date_str}  •  Seuil d'exigence requis : {passing_score}%", fill=slate_text, anchor="mm", font=font_meta)

        # Bas de page : Signatures et Sceau
        font_sig_title = get_font(26, bold=True)
        font_sig_role = get_font(22, bold=False)

        # Signature 1 (Présidence Pédagogique)
        draw.line([(280, 1320), (680, 1320)], fill=navy_color, width=2)
        draw.text((480, 1350), "Direction Académique", fill=navy_color, anchor="mm", font=font_sig_title)
        draw.text((480, 1390), "E-Schola Pro Learning System", fill=slate_text, anchor="mm", font=font_sig_role)

        # Sceau Central Doré
        draw.ellipse([(width // 2 - 90, 1220), (width // 2 + 90, 1400)], fill=(254, 252, 232, 255), outline=gold_color, width=4)
        font_seal = get_font(22, bold=True)
        draw.text((width // 2, 1300), "OFFICIEL", fill=gold_color, anchor="mm", font=font_seal)
        draw.text((width // 2, 1330), "VÉRIFIÉ", fill=navy_color, anchor="mm", font=font_seal)

        # Signature 2 (Comité d'Évaluation)
        draw.line([(width - 680, 1320), (width - 280, 1320)], fill=navy_color, width=2)
        draw.text((width - 480, 1350), "Jury de Certification", fill=navy_color, anchor="mm", font=font_sig_title)
        draw.text((width - 480, 1390), "Validation des Compétences", fill=slate_text, anchor="mm", font=font_sig_role)

        # Numéro de certificat et vérification
        font_code = get_font(18, bold=True)
        draw.text((width // 2, 1510), f"Identifiant de vérification unique : CERT-{certificate_id.upper()}", fill=(148, 163, 184, 255), anchor="mm", font=font_code)

    else:
        # Si un template personnalisé est fourni : on superpose les données aux coordonnées idéales
        draw = ImageDraw.Draw(img)
        font_name = get_font(60, bold=True, serif=True)
        display_name = learner_name.strip() if learner_name and learner_name.strip() else learner_email.split('@')[0].capitalize()
        draw.text((width // 2, 680), display_name, fill=(22, 50, 92, 255), anchor="mm", font=font_name)

        font_cert = get_font(42, bold=True)
        draw.text((width // 2, 850), assessment_title, fill=(15, 23, 42, 255), anchor="mm", font=font_cert)

        date_str = completion_date.strftime("%d/%m/%Y")
        score_val = round(float(score_percentage), 1)
        font_meta = get_font(26, bold=True)
        draw.text((width // 2, 980), f"Score : {score_val}%  •  Délivré le {date_str}", fill=(16, 185, 129, 255), anchor="mm", font=font_meta)

        font_code = get_font(18, bold=True)
        draw.text((width // 2, 1480), f"ID : CERT-{certificate_id.upper()}", fill=(100, 116, 139, 255), anchor="mm", font=font_code)

    # Sauvegarde finale en PNG haute fidélité
    img.save(file_path, "PNG", quality=95)
    return f"/uploads/certificates/{filename}"
