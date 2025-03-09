-- CreateTable
CREATE TABLE "SocialMediaAccount" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "profileImageUrl" TEXT,
    "accessToken" TEXT,
    "accessTokenSecret" TEXT,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),

    CONSTRAINT "SocialMediaAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialMediaPost" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "mediaKey" TEXT,
    "postedToTwitter" BOOLEAN NOT NULL DEFAULT false,
    "postedToInstagram" BOOLEAN NOT NULL DEFAULT false,
    "postedToFacebook" BOOLEAN NOT NULL DEFAULT false,
    "postedToThreads" BOOLEAN NOT NULL DEFAULT false,
    "postedToTikTok" BOOLEAN NOT NULL DEFAULT false,
    "twitterPostId" TEXT,
    "instagramPostId" TEXT,
    "facebookPostId" TEXT,
    "threadsPostId" TEXT,
    "tikTokPostId" TEXT,
    "scheduledFor" TIMESTAMP(3),
    "published" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SocialMediaPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_SocialMediaAccountToSocialMediaPost" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "SocialMediaAccount_userId_platform_handle_key" ON "SocialMediaAccount"("userId", "platform", "handle");

-- CreateIndex
CREATE UNIQUE INDEX "_SocialMediaAccountToSocialMediaPost_AB_unique" ON "_SocialMediaAccountToSocialMediaPost"("A", "B");

-- CreateIndex
CREATE INDEX "_SocialMediaAccountToSocialMediaPost_B_index" ON "_SocialMediaAccountToSocialMediaPost"("B");

-- AddForeignKey
ALTER TABLE "SocialMediaAccount" ADD CONSTRAINT "SocialMediaAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialMediaPost" ADD CONSTRAINT "SocialMediaPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SocialMediaAccountToSocialMediaPost" ADD CONSTRAINT "_SocialMediaAccountToSocialMediaPost_A_fkey" FOREIGN KEY ("A") REFERENCES "SocialMediaAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SocialMediaAccountToSocialMediaPost" ADD CONSTRAINT "_SocialMediaAccountToSocialMediaPost_B_fkey" FOREIGN KEY ("B") REFERENCES "SocialMediaPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
