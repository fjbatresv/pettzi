import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageToggleComponent } from '../language-toggle/language-toggle.component';

@Component({
  selector: 'app-create-header',
  standalone: true,
  imports: [CommonModule, TranslateModule, LanguageToggleComponent],
  templateUrl: './create-header.component.html',
  styleUrl: './create-header.component.scss',
})
export class CreateHeaderComponent implements OnInit {
  @Input() userName = '';

  avatarLabel = '??';

  ngOnInit() {
    const resolvedName = this.userName.trim() || this.getNameFromToken();
    this.avatarLabel = this.buildAvatarLabel(resolvedName);
  }

  private getNameFromToken() {
    const token = localStorage.getItem('pettzi.idToken');
    if (!token) {
      return '';
    }

    const parts = token.split('.');
    if (parts.length < 2) {
      return '';
    }

    try {
      const payload = JSON.parse(this.decodeBase64Url(parts[1])) as Record<string, unknown>;
      const given = this.getStringField(payload, ['given_name', 'givenName']);
      const family = this.getStringField(payload, ['family_name', 'familyName']);
      const fullName = [given, family].filter(Boolean).join(' ').trim();
      if (fullName) {
        return fullName;
      }

      return (
        this.getStringField(payload, ['name', 'preferred_username', 'email', 'cognito:username']) || ''
      );
    } catch {
      return '';
    }
  }

  private getStringField(payload: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
      const value = payload[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    return '';
  }

  private decodeBase64Url(value: string) {
    const base = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base.padEnd(Math.ceil(base.length / 4) * 4, '=');
    return atob(padded);
  }

  private buildAvatarLabel(name: string) {
    const trimmed = name.trim();
    if (!trimmed) {
      return '??';
    }

    const normalized = trimmed.includes('@')
      ? trimmed.split('@')[0].replace(/[._-]+/g, ' ')
      : trimmed;
    const parts = normalized.split(/\s+/).filter(Boolean);

    if (parts.length >= 2) {
      return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
    }

    const single = parts[0] ?? '';
    return single.slice(0, 2).toUpperCase();
  }
}
