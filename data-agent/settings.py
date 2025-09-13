from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    """
    Manages application settings and environment variables.
    Reads from a .env file by default.
    """
    # API Keys
    GOOGLE_API_KEY: SecretStr
    TAVILY_API_KEY: SecretStr
    OPENAI_API_KEY: SecretStr

    GEMINI_MODEL_NAME: str = "gemini-2.5-flash"

    # TiDB Connection Details
    TIDB_HOST: str
    TIDB_PORT: int = 4000
    TIDB_USER: str
    TIDB_PASSWORD: SecretStr
    TIDB_DATABASE: str
    
    # SSL Configuration (with sensible defaults)
    TIDB_SSL_CA: str = "/etc/ssl/cert.pem"
    TIDB_SSL_VERIFY_CERT: bool = True
    TIDB_SSL_VERIFY_IDENTITY: bool = True

    # Pydantic Settings Configuration
    model_config = SettingsConfigDict(
        env_file='.env',
        env_file_encoding='utf-8',
        case_sensitive=False
    )

# Create a single, globally accessible instance of the settings
settings = Settings()