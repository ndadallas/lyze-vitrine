-- Réponses aux messages (fil de discussion Lyze <-> propriétaire)
CREATE TABLE "NoticeReply" (
    "id" TEXT NOT NULL,
    "noticeId" TEXT NOT NULL,
    "fromAdmin" BOOLEAN NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NoticeReply_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "NoticeReply_noticeId_createdAt_idx" ON "NoticeReply"("noticeId", "createdAt");
ALTER TABLE "NoticeReply" ADD CONSTRAINT "NoticeReply_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "OwnerNotice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
