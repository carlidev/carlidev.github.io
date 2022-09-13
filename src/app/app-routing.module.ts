import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { PianoComponent } from './piano/piano.component';

const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'piano', component: PianoComponent },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
