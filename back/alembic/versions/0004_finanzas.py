"""finanzas

Revision ID: 0004
Revises: 0003

Escrita a mano (la 0003 de notas se hizo a la vez): las tablas de app/modules/finance/models.py.
"""
from alembic import op
import sqlalchemy as sa

revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'finance_settings',
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('currency', sa.String(length=3), server_default='PEN', nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('user_id'),
    )
    op.create_table(
        'finance_categories',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('kind', sa.String(length=7), nullable=False),
        sa.Column('name', sa.String(length=40), nullable=False),
        sa.Column('icon', sa.String(length=20), nullable=False),
        sa.Column('color', sa.String(length=20), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.Column('archived', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint("kind IN ('expense', 'income')", name='ck_finance_categories_kind'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_finance_categories_user_kind', 'finance_categories', ['user_id', 'kind'], unique=False)
    op.create_table(
        'finance_transactions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('kind', sa.String(length=7), nullable=False),
        sa.Column('category_id', sa.Integer(), nullable=False),
        sa.Column('amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('occurred_on', sa.Date(), nullable=False),
        sa.Column('note', sa.String(length=200), server_default='', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint("kind IN ('expense', 'income')", name='ck_finance_transactions_kind'),
        sa.CheckConstraint('amount > 0', name='ck_finance_transactions_amount'),
        sa.ForeignKeyConstraint(['category_id'], ['finance_categories.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_finance_transactions_category_id'), 'finance_transactions', ['category_id'], unique=False)
    op.create_index('ix_finance_transactions_user_day', 'finance_transactions', ['user_id', 'occurred_on'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_finance_transactions_user_day', table_name='finance_transactions')
    op.drop_index(op.f('ix_finance_transactions_category_id'), table_name='finance_transactions')
    op.drop_table('finance_transactions')
    op.drop_index('ix_finance_categories_user_kind', table_name='finance_categories')
    op.drop_table('finance_categories')
    op.drop_table('finance_settings')
