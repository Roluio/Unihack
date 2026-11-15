CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Tabelul USERS
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    profile_picture_url VARCHAR(500),
    bio TEXT,
    university VARCHAR(200) NOT NULL,
    faculty VARCHAR(200) NOT NULL,
    specialization VARCHAR(200) NOT NULL,
    study_year INTEGER NOT NULL,
    preferred_language VARCHAR(5) NOT NULL DEFAULT 'RO',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT uq_users_username UNIQUE (username),
    CONSTRAINT chk_users_study_year CHECK (study_year BETWEEN 1 AND 6),
    CONSTRAINT chk_users_language CHECK (preferred_language IN ('RO', 'EN'))
);

CREATE INDEX idx_users_university ON users (LOWER(university));
CREATE INDEX idx_users_faculty ON users (LOWER(faculty));
CREATE INDEX idx_users_full_name ON users (LOWER(first_name), LOWER(last_name));

-- 2. Tabelul FRIENDSHIPS
CREATE TABLE friendships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL,
    receiver_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_friendships_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_friendships_receiver FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_no_self_friendship CHECK (sender_id <> receiver_id),
    CONSTRAINT chk_friendship_status CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED'))
);

CREATE UNIQUE INDEX idx_friendships_unique_active_pair
    ON friendships (LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id))
    WHERE status IN ('PENDING', 'ACCEPTED');

CREATE INDEX idx_friendships_sender_status ON friendships (sender_id, status);
CREATE INDEX idx_friendships_receiver_status ON friendships (receiver_id, status);

-- 3. Tabelul REFRESH_TOKENS
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uq_refresh_tokens_hash UNIQUE (token_hash)
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens (user_id);