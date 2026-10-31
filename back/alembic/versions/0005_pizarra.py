"""pizarra

Revision ID: 0005
Revises: 0004

Generada con --autogenerate contra una base temporal: la tabla `whiteboards` del módulo de pizarra
(app/modules/whiteboard/models.py, docs/contrato-pizarra.md).
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0005'
down_revision = '0004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'whiteboards',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=80), server_default='Sin título', nullable=False),
        sa.Column('elements', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('app_state', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('files', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('element_count', sa.Integer(), server_default='0', nullable=False),
        sa.Column('size_bytes', sa.Integer(), server_default='0', nullable=False),
        sa.Column('thumbnail', sa.LargeBinary(), nullable=True),
        sa.Column('thumbnail_type', sa.String(length=20), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_whiteboards_user_id'), 'whiteboards', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_whiteboards_user_id'), table_name='whiteboards')
    op.drop_table('whiteboards')
