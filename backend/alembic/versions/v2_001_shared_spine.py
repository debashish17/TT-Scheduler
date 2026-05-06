"""v2_001_shared_spine

Revision ID: v2_001
Revises:
Create Date: 2026-05-06 00:27:11.283470

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'v2_001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable uuid-ossp so uuid_generate_v4() is available
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')

    op.create_table('users',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('email', sa.String(length=255), nullable=False),
    sa.Column('full_name', sa.String(length=255), nullable=True),
    sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('NOW()'), nullable=True),
    sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('NOW()'), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)

    op.create_table('runs',
    sa.Column('id', sa.UUID(), server_default=sa.text('uuid_generate_v4()'), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('kind', sa.Enum('school', 'college', name='run_kind'), nullable=False),
    sa.Column('parent_run_id', sa.UUID(), nullable=True),
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('status', sa.Enum('optimal', 'feasible', 'failed', name='run_status'), nullable=False),
    sa.Column('solver', sa.String(length=50), nullable=False),
    sa.Column('solve_time_seconds', sa.Numeric(precision=8, scale=3), nullable=True),
    sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('NOW()'), nullable=True),
    sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('NOW()'), nullable=True),
    sa.ForeignKeyConstraint(['parent_run_id'], ['runs.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_runs_kind'), 'runs', ['kind'], unique=False)
    op.create_index(op.f('ix_runs_parent_run_id'), 'runs', ['parent_run_id'], unique=False)
    op.create_index(op.f('ix_runs_user_id'), 'runs', ['user_id'], unique=False)

    op.create_table('run_soft_constraints',
    sa.Column('id', sa.UUID(), server_default=sa.text('uuid_generate_v4()'), nullable=False),
    sa.Column('run_id', sa.UUID(), nullable=False),
    sa.Column('type', sa.String(length=50), nullable=False),
    sa.Column('target', sa.String(length=255), nullable=False),
    sa.Column('when_value', sa.String(length=50), nullable=True),
    sa.Column('weight', sa.Integer(), nullable=False),
    sa.CheckConstraint('weight BETWEEN 1 AND 10'),
    sa.ForeignKeyConstraint(['run_id'], ['runs.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_run_soft_constraints_run_id'), 'run_soft_constraints', ['run_id'], unique=False)

    # Parent-kind trigger: parent_run_id must have the same kind as the child
    op.execute("""
CREATE OR REPLACE FUNCTION check_parent_kind() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.parent_run_id IS NOT NULL THEN
        IF (SELECT kind FROM runs WHERE id = NEW.parent_run_id) <> NEW.kind THEN
            RAISE EXCEPTION 'parent_run kind must match child run kind';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
""")
    op.execute("""
CREATE TRIGGER runs_parent_kind_check
    BEFORE INSERT OR UPDATE ON runs
    FOR EACH ROW EXECUTE FUNCTION check_parent_kind();
""")

    # updated_at auto-stamp triggers
    op.execute("""
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;
""")
    op.execute("CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();")
    op.execute("CREATE TRIGGER runs_updated_at  BEFORE UPDATE ON runs  FOR EACH ROW EXECUTE FUNCTION set_updated_at();")


def downgrade() -> None:
    # Drop triggers and functions first
    op.execute("DROP TRIGGER IF EXISTS runs_updated_at ON runs;")
    op.execute("DROP TRIGGER IF EXISTS users_updated_at ON users;")
    op.execute("DROP FUNCTION IF EXISTS set_updated_at();")
    op.execute("DROP TRIGGER IF EXISTS runs_parent_kind_check ON runs;")
    op.execute("DROP FUNCTION IF EXISTS check_parent_kind();")

    # Drop tables
    op.drop_index(op.f('ix_run_soft_constraints_run_id'), table_name='run_soft_constraints')
    op.drop_table('run_soft_constraints')
    op.drop_index(op.f('ix_runs_user_id'), table_name='runs')
    op.drop_index(op.f('ix_runs_parent_run_id'), table_name='runs')
    op.drop_index(op.f('ix_runs_kind'), table_name='runs')
    op.drop_table('runs')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')

    # Drop enum types
    op.execute("DROP TYPE IF EXISTS run_status")
    op.execute("DROP TYPE IF EXISTS run_kind")
