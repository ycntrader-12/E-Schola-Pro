import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.models.user import User
from app.models.course import Course
from app.models.course_video import CourseVideo

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "eschola.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def seed_courses():
    session = SessionLocal()
    try:
        # 1. Find or create an instructor
        instructor = session.query(User).filter(User.role.in_(["formateur", "admin", "admin_manager"])).first()
        if not instructor:
            instructor = User(
                username="formateur_principal",
                email="formateur@eschola.pro",
                hashed_password="$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW", # hashed 'admin123'
                role="formateur",
                nom="Dr. Benali",
                prenom="Karim",
                departement="Informatique & Nouvelles Technologies"
            )
            session.add(instructor)
            session.commit()
            session.refresh(instructor)
            print(f"[OK] Formateur créé : {instructor.email} (ID: {instructor.id})")
        else:
            print(f"[INFO] Utilisation de l'instructeur existant : {instructor.email} (ID: {instructor.id})")

        # 2. Courses with organized video folders
        courses_data = [
            {
                "title": "Architecture Next.js 15 & React 19 Fullstack",
                "description": "Maîtrisez le framework web moderne Next.js 15 avec l'App Router, les Server Actions, la gestion du cache et le rendu dynamique à haute performance.",
                "cover_image_url": "https://images.unsplash.com/photo-1633356122544-f134324a6cee?auto=format&fit=crop&w=1200&q=80",
                "document_url": "https://raw.githubusercontent.com/ycntrader-12/E-Schola-Pro/main/docs/syllabus_nextjs15.pdf",
                "videos": [
                    {
                        "title": "01 - Introduction et nouveautés de Next.js 15 & React 19",
                        "description": "Tour d'horizon de l'App Router, des React Server Components et de la configuration du projet.",
                        "video_url": "https://www.youtube.com/watch?v=wm5gMKuwSYk",
                        "order_index": 1
                    },
                    {
                        "title": "02 - Routage Dynamique, Layouts & Navigation i18n",
                        "description": "Structuration des dossiers d'itinéraires, gestion des segments dynamiques et support multilingue.",
                        "video_url": "https://www.youtube.com/watch?v=843nec-IvW0",
                        "order_index": 2
                    },
                    {
                        "title": "03 - Server Actions, Mutations & Sécurité des Formulaires",
                        "description": "Gestion des requêtes POST directes sans couche API intermédiaire, revalidation de chemins et tags.",
                        "video_url": "https://www.youtube.com/watch?v=gSSsZReIFRk",
                        "order_index": 3
                    },
                    {
                        "title": "04 - Optimisation des Performances, Images & Déploiement",
                        "description": "Optimisation Lighthouse à 100%, mise en cache HTTP avancée et déploiement en production.",
                        "video_url": "https://www.youtube.com/watch?v=DJvM2lSPn6w",
                        "order_index": 4
                    }
                ]
            },
            {
                "title": "FastAPI & Python : Développement d'APIs REST Industrielles",
                "description": "Apprenez à concevoir, tester et déployer des microservices performants avec FastAPI, SQLAlchemy 2.0, Pydantic v2 et l'authentification JWT.",
                "cover_image_url": "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80",
                "document_url": "https://raw.githubusercontent.com/ycntrader-12/E-Schola-Pro/main/docs/syllabus_fastapi.pdf",
                "videos": [
                    {
                        "title": "01 - Architecture du framework FastAPI & Pydantic v2",
                        "description": "Mise en place de l'application, validation automatique des schémas de données et documentation Swagger.",
                        "video_url": "https://www.youtube.com/watch?v=0RS9W8MtZe4",
                        "order_index": 1
                    },
                    {
                        "title": "02 - Persistance relationnelle avec SQLAlchemy 2.0 & Migrations Alembic",
                        "description": "Définition des modèles ORM, relations one-to-many et exécution des migrations de base de données.",
                        "video_url": "https://www.youtube.com/watch?v=3vfum74ggHE",
                        "order_index": 2
                    },
                    {
                        "title": "03 - Sécurité avancée, Chiffrement bcrypt & Bearer JWT",
                        "description": "Protection des routes sensibles avec injection de dépendances OAuth2 et contrôle des rôles RBAC.",
                        "video_url": "https://www.youtube.com/watch?v=7t2alSnE2-I",
                        "order_index": 3
                    }
                ]
            },
            {
                "title": "Intelligence Artificielle & Machine Learning avec Python",
                "description": "Programme complet d'initiation à l'analyse de données, au traitement du signal et à l'entraînement d'algorithmes prédictifs avec Pandas, Scikit-Learn et TensorFlow.",
                "cover_image_url": "https://images.unsplash.com/photo-1555949963-aa79dcee981c?auto=format&fit=crop&w=1200&q=80",
                "document_url": "https://raw.githubusercontent.com/ycntrader-12/E-Schola-Pro/main/docs/syllabus_ai_ml.pdf",
                "videos": [
                    {
                        "title": "01 - Préparation et nettoyage des jeux de données avec Pandas",
                        "description": "Nettoyage des valeurs manquantes, agrégations statistiques et normalisation des variables.",
                        "video_url": "https://www.youtube.com/watch?v=vmEHCJofslg",
                        "order_index": 1
                    },
                    {
                        "title": "02 - Modèles d'Apprentissage Supervisé : Régression et Classification",
                        "description": "Entraînement de modèles linéaires, arbres de décision et forêts aléatoires avec Scikit-Learn.",
                        "video_url": "https://www.youtube.com/watch?v=i_LwzRVP7bg",
                        "order_index": 2
                    },
                    {
                        "title": "03 - Évaluation, Matrice de Confusion et Déploiement du Modèle",
                        "description": "Validation croisée, métriques F1-score/AUC et export du modèle pour inférence temps réel.",
                        "video_url": "https://www.youtube.com/watch?v=rfscVS0vtbw",
                        "order_index": 3
                    }
                ]
            },
            {
                "title": "Cybersécurité des Systèmes d'Information & Réseaux",
                "description": "Comprenez les vecteurs d'attaque contemporains, le durcissement d'infrastructures cloud et l'application des référentiels de conformité ISO 27001.",
                "cover_image_url": "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=1200&q=80",
                "document_url": "https://raw.githubusercontent.com/ycntrader-12/E-Schola-Pro/main/docs/syllabus_cybersecurity.pdf",
                "videos": [
                    {
                        "title": "01 - Principes fondamentaux de sécurité & Menaces OWASP Top 10",
                        "description": "Analyse des vulnérabilités critiques : injections SQL, XSS, CSRF et failles d'authentification.",
                        "video_url": "https://www.youtube.com/watch?v=EoaDgUgS6QA",
                        "order_index": 1
                    },
                    {
                        "title": "02 - Cryptographie appliquée, Gestion des Clés & Certificats TLS/SSL",
                        "description": "Chiffrement asymétrique RSA/ECC, signatures numériques et sécurisation des flux réseau.",
                        "video_url": "https://www.youtube.com/watch?v=jhXCTbFnK8o",
                        "order_index": 2
                    }
                ]
            }
        ]

        total_courses_created = 0
        total_videos_created = 0

        for c_data in courses_data:
            existing = session.query(Course).filter(Course.title == c_data["title"]).first()
            if not existing:
                course = Course(
                    title=c_data["title"],
                    description=c_data["description"],
                    cover_image_url=c_data["cover_image_url"],
                    document_url=c_data.get("document_url"),
                    instructor_id=instructor.id
                )
                session.add(course)
                session.commit()
                session.refresh(course)
                total_courses_created += 1

                for v_data in c_data["videos"]:
                    video = CourseVideo(
                        course_id=course.id,
                        title=v_data["title"],
                        description=v_data["description"],
                        video_url=v_data["video_url"],
                        order_index=v_data["order_index"]
                    )
                    session.add(video)
                    total_videos_created += 1
                session.commit()
                print(f"[OK] Dossier de cours créé : {course.title} avec {len(c_data['videos'])} vidéos")
            else:
                print(f"[INFO] Cours déjà existant : {existing.title}")

        print(f"\n==> Succès : {total_courses_created} dossiers de cours et {total_videos_created} vidéos insérés en base de données.")
    finally:
        session.close()

if __name__ == "__main__":
    seed_courses()
