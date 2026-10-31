"""horas trabajadas

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-31 19:35:33.273612
"""
from alembic import op
import sqlalchemy as sa


revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('work_hours',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('day', sa.Date(), nullable=False),
    sa.Column('hours', sa.Numeric(precision=4, scale=1), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'day', name='ux_work_hours_user_day')
    )
    op.create_index(op.f('ix_work_hours_user_id'), 'work_hours', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_work_hours_user_id'), table_name='work_hours')
    op.drop_table('work_hours')
