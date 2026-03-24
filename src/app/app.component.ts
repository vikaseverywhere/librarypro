import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss']
})
export class AppComponent implements OnInit {
  constructor(private router: Router) {
    console.log('AppComponent constructor');
  }

  ngOnInit() {
    console.log('AppComponent ngOnInit');
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        console.log('Navigation successful:', event.url, event.urlAfterRedirects);
      }
    });
  }
}
