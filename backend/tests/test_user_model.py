from sqlalchemy import CheckConstraint, UniqueConstraint

from app.models.user import User


def test_users_table_name():
    assert User.__tablename__ == "users"


def test_required_and_optional_columns():
    columns = User.__table__.columns
    assert columns["name"].nullable is False
    assert columns["password_hash"].nullable is False
    assert columns["is_active"].nullable is False
    assert columns["email"].nullable is True
    assert columns["phone"].nullable is True
    assert columns["email_verified_at"].nullable is True
    assert columns["phone_verified_at"].nullable is True
    assert columns["last_login_at"].nullable is True


def test_email_and_phone_are_unique():
    unique_columns = {
        constraint.columns.keys()[0]
        for constraint in User.__table__.constraints
        if isinstance(constraint, UniqueConstraint)
    }
    assert unique_columns == {"email", "phone"}


def test_email_or_phone_required_check_constraint():
    check_constraints = [
        constraint
        for constraint in User.__table__.constraints
        if isinstance(constraint, CheckConstraint)
    ]
    assert any(
        constraint.name == "ck_users_email_or_phone_required"
        for constraint in check_constraints
    )
