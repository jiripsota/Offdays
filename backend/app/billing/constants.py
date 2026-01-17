from enum import Enum

# Plan Constants matching DB Schema
class PlanID(str, Enum):
    # Format: TIER_CYCLE
    SMALL_MONTHLY = "SMALL_MONTHLY"
    SMALL_ANNUAL = "SMALL_ANNUAL"
    MEDIUM_MONTHLY = "MEDIUM_MONTHLY"
    MEDIUM_ANNUAL = "MEDIUM_ANNUAL"
    LARGE_MONTHLY = "LARGE_MONTHLY"
    LARGE_ANNUAL = "LARGE_ANNUAL"


    # Trial
    TRIAL = "TRIAL"

# Define Plan Details (Could be loaded from config/DB, but hardcoded for seed/defaults)
PLAN_DETAILS = {
    PlanID.SMALL_MONTHLY: {
        "tier": "small", "cycle": "monthly",
        "max_users": 10, "price_cents": 1500, "sku": "small-monthly"
    },
    PlanID.SMALL_ANNUAL: {
        "tier": "small", "cycle": "annual",
        "max_users": 10, "price_cents": 15000, "sku": "small-annual"
    },
    PlanID.MEDIUM_MONTHLY: {
        "tier": "medium", "cycle": "monthly",
        "max_users": 50, "price_cents": 3900, "sku": "medium-monthly"
    },
    PlanID.MEDIUM_ANNUAL: {
        "tier": "medium", "cycle": "annual",
        "max_users": 50, "price_cents": 39000, "sku": "medium-annual"
    },
    PlanID.LARGE_MONTHLY: {
        "tier": "large", "cycle": "monthly",
        "max_users": 200, "price_cents": 7500, "sku": "large-monthly"
    },
    PlanID.LARGE_ANNUAL: {
        "tier": "large", "cycle": "annual",
        "max_users": 200, "price_cents": 75000, "sku": "large-annual"
    },

    PlanID.TRIAL: {
        "tier": "trial", "cycle": "monthly",
        "max_users": 200, "price_cents": 0, "sku": "trial"
    }
}
