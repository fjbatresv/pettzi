import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { LanguageToggleComponent } from '../../components/language-toggle/language-toggle.component';

type ConfirmState = 'loading' | 'success' | 'error';

@Component({
  selector: 'app-email-confirm',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, TranslateModule, LanguageToggleComponent],
  templateUrl: './email-confirm.component.html',
  styleUrl: './email-confirm.component.scss',
})
export class EmailConfirmComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly i18n = inject(I18nService);

  state: ConfirmState = 'loading';
  errorMessage = '';
  responseMessage = '';

  ngOnInit() {
    const token = this.route.snapshot.queryParamMap.get('token')?.trim();
    if (!token) {
      this.state = 'error';
      this.errorMessage = this.i18n.t('emailConfirm.missingToken');
      return;
    }

    this.auth.confirmEmail(token).subscribe({
      next: (response) => {
        this.state = 'success';
        this.responseMessage = response.message ?? '';
      },
      error: (err: Error) => {
        this.state = 'error';
        this.errorMessage = err.message;
      },
    });
  }
}
