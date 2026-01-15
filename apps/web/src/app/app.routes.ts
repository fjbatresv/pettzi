import { Route } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { SignupComponent } from './pages/signup/signup.component';
import { PetCreateStep1Component } from './pages/pet-create-step1/pet-create-step1.component';
import { PetCreateStep2Component } from './pages/pet-create-step2/pet-create-step2.component';
import { DashboardMainComponent } from './pages/dashboard-main/dashboard-main.component';
import { DashboardPetComponent } from './pages/dashboard-pet/dashboard-pet.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { DashboardLayoutComponent } from './components/dashboard-layout/dashboard-layout.component';
import { GroomingComponent } from './pages/grooming/grooming.component';
import { VetVisitComponent } from './pages/vet-visit/vet-visit.component';
import { MedicationComponent } from './pages/medication/medication.component';
import { VaccineComponent } from './pages/vaccine/vaccine.component';
import { WeightComponent } from './pages/weight/weight.component';
import { PetEditComponent } from './pages/pet-edit/pet-edit.component';
import { SettingsComponent } from './pages/settings/settings.component';
import { ForgotPasswordComponent } from './pages/forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './pages/reset-password/reset-password.component';
import { EmailConfirmComponent } from './pages/email-confirm/email-confirm.component';
import { AccountDeletedComponent } from './pages/account-deleted/account-deleted.component';
import { authenticatedGuard } from './core/guards/authenticated.guard';
import { unauthenticatedGuard } from './core/guards/unauthenticated.guard';

export const appRoutes: Route[] = [
  {
    path: '',
    component: LoginComponent,
    canActivate: [unauthenticatedGuard],
  },
  {
    path: 'signup',
    component: SignupComponent,
    canActivate: [unauthenticatedGuard],
  },
  {
    path: 'forgot-password',
    component: ForgotPasswordComponent,
    canActivate: [unauthenticatedGuard],
  },
  {
    path: 'reset-password',
    component: ResetPasswordComponent,
    canActivate: [unauthenticatedGuard],
  },
  {
    path: 'email-confirm',
    component: EmailConfirmComponent,
  },
  {
    path: 'account-deleted',
    component: AccountDeletedComponent,
    canActivate: [unauthenticatedGuard],
  },
  {
    path: 'pets/new',
    component: PetCreateStep1Component,
    canActivate: [authenticatedGuard],
  },
  {
    path: 'pets/new/details',
    component: PetCreateStep2Component,
    canActivate: [authenticatedGuard],
  },
  {
    path: 'dashboard',
    component: DashboardLayoutComponent,
    canActivate: [authenticatedGuard],
    children: [
      {
        path: '',
        component: DashboardComponent,
      },
      {
        path: 'main',
        component: DashboardMainComponent,
      },
      {
        path: 'pet/edit',
        component: PetEditComponent,
      },
      {
        path: 'grooming',
        component: GroomingComponent,
      },
      {
        path: 'vet-visit',
        component: VetVisitComponent,
      },
      {
        path: 'medication',
        component: MedicationComponent,
      },
      {
        path: 'vaccine',
        component: VaccineComponent,
      },
      {
        path: 'weight',
        component: WeightComponent,
      },
      {
        path: 'pet',
        component: DashboardPetComponent,
      },
      {
        path: 'settings',
        component: SettingsComponent,
      },
    ],
  },
];
