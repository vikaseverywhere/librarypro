import { Injectable } from '@angular/core';
import { Router, CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { filter, map, take, switchMap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    // Wait until AngularFire authState has emitted once after refresh.
    return this.authService.isAuthResolved.pipe(
      filter((resolved) => resolved),
      take(1),
      switchMap(() => this.authService.isAuthenticated),
      map((isAuthenticated) => {
        if (isAuthenticated) return true;
        this.router.navigate(['/auth/login']);
        return false;
      })
    );
  }
}
