# Publicação mobile por ADB Wi-Fi

Os scripts desta pasta permitem validar, parear, conectar e publicar o BudgetApp em um dispositivo Android usando ADB por Wi-Fi, sem depender do VS Code ou de cabo USB.

## Comandos

```powershell
npm run mobile:status
npm run mobile:connect -- -Target 192.168.1.114:46575
npm run mobile:pair -- -PairingTarget 192.168.1.114:39671
npm run mobile:publish
npm run build:mobile
npm run build:mobile2
```

- `mobile:status`: lista dispositivos e tenta reconectar dispositivos pareados via mDNS.
- `mobile:connect`: conecta usando o IP e a porta exibidos na tela principal de Depuração sem fio.
- `mobile:pair`: realiza um novo pareamento usando o endereço temporário e solicita o código sem gravá-lo na linha de comando.
- `mobile:publish` e `build:mobile`: geram o build Angular de produção, sincronizam o Capacitor, compilam, instalam e abrem o app.
- `build:mobile2`: publica reutilizando os arquivos web já gerados.

O endereço IP e a porta não são gravados nos scripts. Quando o dispositivo já está pareado, os scripts tentam descobri-lo automaticamente via mDNS.
