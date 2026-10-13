/// <reference types="jasmine" />

import { of } from 'rxjs';
import { AccountPostingsComponent } from './accountpostings.component';

describe('edição do saldo bruto', () => {
  function createComponent(updateResponse: any, persistedValue?: number): {
    component: AccountPostingsComponent;
    update: jasmine.Spy;
    read: jasmine.Spy;
    message: jasmine.Spy;
    errorHandler: jasmine.Spy;
  } {
    const component = Object.create(AccountPostingsComponent.prototype) as any;
    const update = jasmine.createSpy('update').and.returnValue(of(updateResponse));
    const read = jasmine.createSpy('read').and.returnValue(of([
      { id: 7, name: 'Conta', totalBalanceGross: persistedValue }
    ]));
    const message = jasmine.createSpy('message');
    const errorHandler = jasmine.createSpy('errorHandler').and.returnValue(of(null));

    component.dialog = {
      open: () => ({ afterClosed: () => of(7552.13) })
    };
    component.accountService = { update, read };
    component.messenger = { message, errorHandler };
    component.account = { id: 7, userId: 1, name: 'Conta', totalBalanceGross: 7552.14 };
    component.accountId = 7;
    component.cdr = { markForCheck: () => undefined };
    component.accountsList = [component.account];
    component.totalGrossBalance = 7552.14;
    component.currentGrossBalance = 7552.14;
    component.accountUpdated = { emit: jasmine.createSpy('emit') };

    return { component, update, read, message, errorHandler };
  }

  it('envia o valor numérico ao PUT e só confirma quando a resposta traz o valor salvo', () => {
    const setup = createComponent({ totalBalanceGross: 7552.13 });

    setup.component.editGrossBalance();

    expect(setup.update).toHaveBeenCalledWith(jasmine.objectContaining({ id: 7, totalBalanceGross: 7552.13 }));
    expect(setup.read).not.toHaveBeenCalled();
    expect(setup.component.totalGrossBalance).toBe(7552.13);
    expect(setup.message).toHaveBeenCalledWith('Saldo bruto atualizado com sucesso.');
  });

  it('verifica com GET quando o PUT não devolve o saldo e não simula sucesso se ele não persistiu', () => {
    const setup = createComponent(null, 7552.14);

    setup.component.editGrossBalance();

    expect(setup.read).toHaveBeenCalled();
    expect(setup.component.totalGrossBalance).toBe(7552.14);
    expect(setup.errorHandler).toHaveBeenCalledWith('A API não confirmou a gravação do saldo bruto.');
    expect(setup.message).not.toHaveBeenCalled();
  });
});
