"""notas

Revision ID: 0003
Revises: 0002

Escrita a mano (no con --autogenerate): la tabla `notes` del módulo de notas
(docs/contrato-notas.md).
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'notes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('content', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('plain', sa.Text(), server_default='', nullable=False),
        sa.Column('title', sa.String(length=200), server_default='', nullable=False),
        sa.Column('preview', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('color', sa.String(length=10), server_default='default', nullable=False),
        sa.Column('pinned', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_notes_user_id'), 'notes', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_notes_user_id'), table_name='notes')
    op.drop_table('notes')
