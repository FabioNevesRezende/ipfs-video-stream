alter table users add column `hostIpfsCopy` TINYINT(1) NOT NULL DEFAULT false;
alter table userconfirmtokens modify `token` VARCHAR(768) NOT NULL UNIQUE;