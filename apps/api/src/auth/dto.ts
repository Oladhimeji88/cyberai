import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(10)
  password!: string;

  @IsString()
  orgName!: string;

  @IsOptional()
  @IsString()
  mfaCode?: string;

  @IsOptional()
  @IsString()
  deviceLabel?: string;
}
