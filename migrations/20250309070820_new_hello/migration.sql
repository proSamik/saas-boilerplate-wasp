/*
  Warnings:

  - You are about to drop the `SocialMediaAccount` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SocialMediaPost` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_SocialMediaAccountToSocialMediaPost` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "SocialMediaAccount" DROP CONSTRAINT "SocialMediaAccount_userId_fkey";

-- DropForeignKey
ALTER TABLE "SocialMediaPost" DROP CONSTRAINT "SocialMediaPost_userId_fkey";

-- DropForeignKey
ALTER TABLE "_SocialMediaAccountToSocialMediaPost" DROP CONSTRAINT "_SocialMediaAccountToSocialMediaPost_A_fkey";

-- DropForeignKey
ALTER TABLE "_SocialMediaAccountToSocialMediaPost" DROP CONSTRAINT "_SocialMediaAccountToSocialMediaPost_B_fkey";

-- DropTable
DROP TABLE "SocialMediaAccount";

-- DropTable
DROP TABLE "SocialMediaPost";

-- DropTable
DROP TABLE "_SocialMediaAccountToSocialMediaPost";
