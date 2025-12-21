from app.database import engine
from app.startup_migration import seed_initial_data

if __name__ == "__main__":
    print("🚀 Manually triggering seed...")
    seed_initial_data(engine)
    print("🏁 Manual seed finished.")
