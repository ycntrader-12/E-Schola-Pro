from sqladmin import ModelView

from app.models.attendance import Attendance
from app.models.classroom import Classroom
from app.models.course import Course
from app.models.course_video import CourseVideo
from app.models.enrollment import Enrollment
from app.models.event import Event, EventDeliverable
from app.models.group import Group, GroupMember
from app.models.message import Message
from app.models.quiz import Quiz, QuizAttempt, QuizQuestion
from app.models.user import User


class UserAdmin(ModelView, model=User):
    column_list = [User.id, User.email, User.role, User.group_name]
    column_searchable_list = [User.email]
    column_sortable_list = [User.id, User.email]
    name = "Utilisateur"
    name_plural = "Utilisateurs"
    icon = "fa-solid fa-user"


class CourseAdmin(ModelView, model=Course):
    column_list = [Course.id, Course.title, Course.instructor_id]
    column_searchable_list = [Course.title]
    column_sortable_list = [Course.id, Course.title]
    name = "Cours"
    name_plural = "Cours"
    icon = "fa-solid fa-book"


class CourseVideoAdmin(ModelView, model=CourseVideo):
    column_list = [
        CourseVideo.id,
        CourseVideo.course_id,
        CourseVideo.title,
        CourseVideo.order_index,
    ]
    column_searchable_list = [CourseVideo.title]
    name = "Vidéo de Cours"
    name_plural = "Vidéos de Cours"
    icon = "fa-solid fa-film"


class EnrollmentAdmin(ModelView, model=Enrollment):
    column_list = [
        Enrollment.id,
        Enrollment.user_id,
        Enrollment.course_id,
        Enrollment.enrolled_at,
    ]
    name = "Inscription"
    name_plural = "Inscriptions"
    icon = "fa-solid fa-graduation-cap"


class ClassroomAdmin(ModelView, model=Classroom):
    column_list = [
        Classroom.id,
        Classroom.room_id,
        Classroom.title,
        Classroom.instructor_id,
        Classroom.is_active,
        Classroom.created_at,
    ]
    column_searchable_list = [Classroom.room_id, Classroom.title]
    name = "Classe Virtuelle"
    name_plural = "Classes Virtuelles"
    icon = "fa-solid fa-video"


class MessageAdmin(ModelView, model=Message):
    column_list = [
        Message.id,
        Message.sender_id,
        Message.recipient_id,
        Message.subject,
        Message.is_read,
        Message.created_at,
    ]
    column_searchable_list = [Message.subject, Message.body]
    name = "Message"
    name_plural = "Messages"
    icon = "fa-solid fa-envelope"


class EventAdmin(ModelView, model=Event):
    column_list = [
        Event.id,
        Event.title,
        Event.start_time,
        Event.end_time,
        Event.target_roles,
    ]
    column_searchable_list = [Event.title]
    name = "Événement Calendrier"
    name_plural = "Événements Calendrier"
    icon = "fa-solid fa-calendar"


class EventDeliverableAdmin(ModelView, model=EventDeliverable):
    column_list = [
        EventDeliverable.id,
        EventDeliverable.event_id,
        EventDeliverable.user_id,
        EventDeliverable.submitted_at,
    ]
    name = "Livrable Événement"
    name_plural = "Livrables Événements"
    icon = "fa-solid fa-file-arrow-up"


class QuizAdmin(ModelView, model=Quiz):
    column_list = [
        Quiz.id,
        Quiz.title,
        Quiz.created_by_id,
        Quiz.target_roles,
        Quiz.time_limit_minutes,
        Quiz.created_at,
    ]
    column_searchable_list = [Quiz.title]
    name = "Quiz"
    name_plural = "Quiz"
    icon = "fa-solid fa-award"


class QuizQuestionAdmin(ModelView, model=QuizQuestion):
    column_list = [
        QuizQuestion.id,
        QuizQuestion.quiz_id,
        QuizQuestion.question_text,
        QuizQuestion.points,
    ]
    name = "Question Quiz"
    name_plural = "Questions Quiz"
    icon = "fa-solid fa-circle-question"


class QuizAttemptAdmin(ModelView, model=QuizAttempt):
    column_list = [
        QuizAttempt.id,
        QuizAttempt.quiz_id,
        QuizAttempt.user_id,
        QuizAttempt.score,
        QuizAttempt.max_score,
        QuizAttempt.percentage,
        QuizAttempt.completed_at,
    ]
    name = "Tentative Quiz"
    name_plural = "Tentatives Quiz"
    icon = "fa-solid fa-chart-simple"


class AttendanceAdmin(ModelView, model=Attendance):
    column_list = [
        Attendance.id,
        Attendance.user_id,
        Attendance.date,
        Attendance.status,
        Attendance.session_name,
        Attendance.marked_by_id,
    ]
    column_searchable_list = [Attendance.session_name]
    column_sortable_list = [Attendance.date, Attendance.status]
    name = "Présence"
    name_plural = "Présences"
    icon = "fa-solid fa-clipboard-user"


class GroupAdmin(ModelView, model=Group):
    column_list = [Group.id, Group.name, Group.level, Group.created_at]
    column_searchable_list = [Group.name, Group.level]
    name = "Groupe / Classe"
    name_plural = "Groupes / Classes"
    icon = "fa-solid fa-users"


class GroupMemberAdmin(ModelView, model=GroupMember):
    column_list = [
        GroupMember.id,
        GroupMember.group_id,
        GroupMember.user_id,
        GroupMember.joined_at,
    ]
    name = "Membre de Groupe"
    name_plural = "Membres de Groupes"
    icon = "fa-solid fa-user-plus"
