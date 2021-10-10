alter table users add column `hostIpfsCopy` TINYINT(1) NOT NULL DEFAULT false;
alter table userconfirmtokens modify `token` VARCHAR(768) NOT NULL UNIQUE;
alter table files modify `duration` VARCHAR(64);