"""Tests for Run and RunSoftConstraint models."""
from sqlalchemy import inspect


def test_run_columns():
    from app.models.shared.run import Run
    cols = {c.name for c in inspect(Run).columns}
    assert cols == {
        "id", "user_id", "kind", "parent_run_id", "name", "status",
        "solver", "solve_time_seconds", "created_at", "updated_at",
    }


def test_run_kind_enum_values():
    from app.models.shared.run import Run, RunKind
    assert {k.value for k in RunKind} == {"school", "college"}


def test_run_status_enum_values():
    from app.models.shared.run import Run, RunStatus
    assert {s.value for s in RunStatus} == {"optimal", "feasible", "failed"}


def test_run_user_id_fk_cascade():
    from app.models.shared.run import Run
    fk = next(iter(inspect(Run).columns["user_id"].foreign_keys))
    assert fk.column.table.name == "users"
    assert fk.ondelete == "CASCADE"


def test_run_parent_self_reference():
    from app.models.shared.run import Run
    fk = next(iter(inspect(Run).columns["parent_run_id"].foreign_keys))
    assert fk.column.table.name == "runs"
    assert fk.ondelete == "SET NULL"


def test_soft_constraint_columns():
    from app.models.shared.soft_constraint import RunSoftConstraint
    cols = {c.name for c in inspect(RunSoftConstraint).columns}
    assert cols == {"id", "run_id", "type", "target", "when_value", "weight"}
