import {
  ActivatedRouteSnapshot,
  DetachedRouteHandle,
  RouteReuseStrategy,
} from '@angular/router';

export class CustomReuseStrategy implements RouteReuseStrategy {
  private storedHandles = new Map<string, DetachedRouteHandle>();

  // Define quais rotas devem ser armazenadas (adicione mais conforme desejar)
  private reusableRoutes = [
    'summary',
    'budget',
    'accounts',
    'cards',
    'reports',
  ];

  // Verifica se a rota deve ser desconectada (armazenada)
  shouldDetach(route: ActivatedRouteSnapshot): boolean {
    return (
      !!route.routeConfig?.path &&
      this.reusableRoutes.includes(route.routeConfig.path)
    );
  }

  // Armazena o componente da rota
  store(route: ActivatedRouteSnapshot, handle: DetachedRouteHandle): void {
    if (route.routeConfig?.path) {
      this.storedHandles.set(route.routeConfig.path, handle);
    }
  }

  // Verifica se deve reutilizar a rota
  shouldAttach(route: ActivatedRouteSnapshot): boolean {
    return (
      !!route.routeConfig?.path &&
      this.storedHandles.has(route.routeConfig.path)
    );
  }

  // Recupera o componente armazenado
  retrieve(route: ActivatedRouteSnapshot): DetachedRouteHandle | null {
    if (!route.routeConfig?.path) return null;
    return this.storedHandles.get(route.routeConfig.path) || null;
  }

  // Reutiliza a rota se for exatamente a mesma (rota ativa vs nova)
  shouldReuseRoute(
    future: ActivatedRouteSnapshot,
    curr: ActivatedRouteSnapshot
  ): boolean {
    return future.routeConfig === curr.routeConfig;
  }
}
