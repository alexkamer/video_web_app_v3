from sqlalchemy import Column, Integer, String, Text, Float, ForeignKey, Table, Boolean, DateTime, Enum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import ARRAY
import enum

Base = declarative_base()

# Association tables for many-to-many relationships
video_tag = Table(
    'video_tag',
    Base.metadata,
    Column('video_id', Integer, ForeignKey('videos.id'), primary_key=True),
    Column('tag_id', Integer, ForeignKey('tags.id'), primary_key=True)
)

user_bookmark = Table(
    'user_bookmark',
    Base.metadata,
    Column('user_id', Integer, ForeignKey('users.id'), primary_key=True),
    Column('video_id', Integer, ForeignKey('videos.id'), primary_key=True),
    Column('created_at', DateTime, default=func.now())
)


class DifficultyLevel(enum.Enum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"


class Video(Base):
    __tablename__ = 'videos'
    
    id = Column(Integer, primary_key=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    video_url = Column(String(512), nullable=False)
    thumbnail_url = Column(String(512))
    duration = Column(Float)  # in seconds
    views = Column(Integer, default=0)
    likes = Column(Integer, default=0)
    difficulty = Column(Enum(DifficultyLevel), default=DifficultyLevel.INTERMEDIATE)
    transcript = Column(Text)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    tags = relationship("Tag", secondary=video_tag, back_populates="videos")
    insights = relationship("VideoInsight", back_populates="video", cascade="all, delete-orphan")
    quiz_questions = relationship("QuizQuestion", back_populates="video", cascade="all, delete-orphan")
    user_bookmarks = relationship("User", secondary=user_bookmark, back_populates="bookmarked_videos")
    user_progress = relationship("UserVideoProgress", back_populates="video", cascade="all, delete-orphan")


class Tag(Base):
    __tablename__ = 'tags'
    
    id = Column(Integer, primary_key=True)
    name = Column(String(50), unique=True, nullable=False)
    
    # Relationships
    videos = relationship("Video", secondary=video_tag, back_populates="tags")


class VideoInsight(Base):
    __tablename__ = 'video_insights'
    
    id = Column(Integer, primary_key=True)
    video_id = Column(Integer, ForeignKey('videos.id'), nullable=False)
    timestamp = Column(Float)  # in seconds
    text = Column(Text, nullable=False)
    
    # Relationships
    video = relationship("Video", back_populates="insights")


class QuizQuestion(Base):
    __tablename__ = 'quiz_questions'
    
    id = Column(Integer, primary_key=True)
    video_id = Column(Integer, ForeignKey('videos.id'), nullable=False)
    question_text = Column(Text, nullable=False)
    options = Column(ARRAY(String(255)))  # PostgreSQL specific
    correct_answer = Column(String(255), nullable=False)
    explanation = Column(Text)
    difficulty = Column(Enum(DifficultyLevel), default=DifficultyLevel.INTERMEDIATE)
    
    # Relationships
    video = relationship("Video", back_populates="quiz_questions")
    user_answers = relationship("UserQuizAnswer", back_populates="question", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = 'users'
    
    id = Column(Integer, primary_key=True)
    username = Column(String(50), unique=True, nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(100))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())
    
    # Relationships
    bookmarked_videos = relationship("Video", secondary=user_bookmark, back_populates="user_bookmarks")
    video_progress = relationship("UserVideoProgress", back_populates="user", cascade="all, delete-orphan")
    quiz_answers = relationship("UserQuizAnswer", back_populates="user", cascade="all, delete-orphan")


class UserVideoProgress(Base):
    __tablename__ = 'user_video_progress'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    video_id = Column(Integer, ForeignKey('videos.id'), nullable=False)
    watched_seconds = Column(Float, default=0)  # Current position in the video
    completion_percentage = Column(Float, default=0)  # 0-100
    last_watched_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="video_progress")
    video = relationship("Video", back_populates="user_progress")


class UserQuizAnswer(Base):
    __tablename__ = 'user_quiz_answers'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    question_id = Column(Integer, ForeignKey('quiz_questions.id'), nullable=False)
    user_answer = Column(String(255))
    is_correct = Column(Boolean)
    answered_at = Column(DateTime, default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="quiz_answers")
    question = relationship("QuizQuestion", back_populates="user_answers")


# Database connection and session management code would go here in a real application