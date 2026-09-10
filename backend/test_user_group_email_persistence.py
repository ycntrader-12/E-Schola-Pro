"""
Test suite validating complete persistence and synchronization of:
- User email modifications
- User group_name modifications and GroupMember synchronization
- Admin user updates (PUT /users/{id})
- Self profile updates (PUT /users/me)
- Attendance learner group assignment (POST /attendance/learners)
- Non-destructive startup seed behavior (ensures no data wiped upon restart/commit)
"""
import sys
import unittest
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import create_access_token
from app.db.database import SessionLocal
from app.models.user import User
from app.models.group import Group, GroupMember
from create_admin import seed_users, seed_groups


class TestUserGroupEmailPersistence(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.db = SessionLocal()

        # Ensure root admin and demo groups exist
        seed_users()
        seed_groups()

        # Find or create test admin
        cls.admin = cls.db.query(User).filter(User.role == "admin").first()
        assert cls.admin is not None, "Admin user must exist"
        cls.admin_token = create_access_token(cls.admin.id)
        cls.admin_headers = {"Authorization": f"Bearer {cls.admin_token}"}

        # Find or create test student
        cls.student = cls.db.query(User).filter(User.role.in_(["étudiant", "stagiaire"])).first()
        assert cls.student is not None, "Student user must exist"
        cls.student_token = create_access_token(cls.student.id)
        cls.student_headers = {"Authorization": f"Bearer {cls.student_token}"}

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def test_01_update_me_group_name_and_sync(self):
        """Test that PUT /users/me updates group_name AND synchronizes GroupMember row."""
        # Find group B
        grp_b = self.db.query(Group).filter(Group.name.ilike("%Cybersécurité%")).first()
        self.assertIsNotNone(grp_b)

        resp = self.client.put(
            "/api/v1/users/me",
            headers=self.student_headers,
            json={"group_name": grp_b.name}
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["group_name"], grp_b.name)

        # Verify DB directly
        self.db.refresh(self.student)
        self.assertEqual(self.student.group_name, grp_b.name)

        # Verify GroupMember row exists
        membership = self.db.query(GroupMember).filter(
            GroupMember.user_id == self.student.id,
            GroupMember.group_id == grp_b.id
        ).first()
        self.assertIsNotNone(membership)

    def test_02_admin_update_user_email_and_group(self):
        """Test that Admin PUT /users/{id} updates email and group_name with full synchronization."""
        grp_c = self.db.query(Group).filter(Group.name.ilike("%Data Science%")).first()
        self.assertIsNotNone(grp_c)

        new_email = f"learner_{self.student.id}_persisted@eschola.pro"

        resp = self.client.put(
            f"/api/v1/users/{self.student.id}",
            headers=self.admin_headers,
            json={
                "email": new_email,
                "group_name": grp_c.name,
                "nom": "PersistNom",
                "prenom": "PersistPrenom"
            }
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["email"], new_email)
        self.assertEqual(data["group_name"], grp_c.name)

        # Verify in DB
        self.db.refresh(self.student)
        self.assertEqual(self.student.email, new_email)
        self.assertEqual(self.student.group_name, grp_c.name)

        # Verify GroupMember synchronized to group C
        membership = self.db.query(GroupMember).filter(
            GroupMember.user_id == self.student.id,
            GroupMember.group_id == grp_c.id
        ).first()
        self.assertIsNotNone(membership)

    def test_03_attendance_learner_group_sync(self):
        """Test that POST /attendance/learners updates user group and creates GroupMember row."""
        grp_a = self.db.query(Group).first()
        self.assertIsNotNone(grp_a)

        resp = self.client.post(
            "/api/v1/attendance/learners",
            headers=self.admin_headers,
            json={
                "email": self.student.email,
                "role": self.student.role,
                "group_name": grp_a.name
            }
        )
        self.assertEqual(resp.status_code, 200)
        self.db.refresh(self.student)
        self.assertEqual(self.student.group_name, grp_a.name)

        membership = self.db.query(GroupMember).filter(
            GroupMember.user_id == self.student.id,
            GroupMember.group_id == grp_a.id
        ).first()
        self.assertIsNotNone(membership)

    def test_04_startup_seed_preserves_custom_data(self):
        """
        Verify that running startup scripts (seed_users, seed_groups) never
        overwrites customized emails, group assignments, or passwords.
        """
        custom_email = self.student.email
        custom_group = self.student.group_name

        # Run startup routines
        seed_users()
        seed_groups()

        # Re-fetch from fresh session
        fresh_db = SessionLocal()
        check_user = fresh_db.query(User).filter(User.id == self.student.id).first()
        self.assertEqual(check_user.email, custom_email)
        self.assertEqual(check_user.group_name, custom_group)
        fresh_db.close()


    def test_05_unassign_group_removes_membership(self):
        """
        Verify that passing an empty or null group_name cleanly dissociates
        the user from any group and deletes the GroupMember row.
        """
        resp = self.client.put(
            f"/api/v1/users/{self.student.id}",
            headers=self.admin_headers,
            json={"group_name": ""}
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIsNone(data["group_name"])

        # Check DB
        self.db.refresh(self.student)
        self.assertIsNone(self.student.group_name)
        membership = self.db.query(GroupMember).filter(GroupMember.user_id == self.student.id).first()
        self.assertIsNone(membership)


if __name__ == "__main__":
    unittest.main()
