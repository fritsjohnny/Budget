# Contrato esperado para tools mobile do MCP Budget

As tools devem executar somente scripts previamente aprovados dentro de `budgetsite/scripts`. Não devem aceitar comandos de shell arbitrários.

## budget_mobile_status

Executa `mobile-status.ps1` e retorna:

- caminho do ADB;
- dispositivos encontrados;
- serial/endereço;
- modelo;
- estado;
- tipo de conexão;
- indicação se está pronto para publicação.

## budget_mobile_connect

Entrada obrigatória:

- `target`: endereço `IP:PORTA` exibido na tela principal de Depuração sem fio.

Executa `mobile-connect.ps1 -Target <target>`.

## budget_mobile_pair

Entradas obrigatórias:

- `pairingTarget`: endereço `IP:PORTA` da tela Parear dispositivo com código de pareamento;
- `pairingCode`: código numérico temporário de seis dígitos.

Executa `mobile-pair.ps1 -PairingTarget <pairingTarget>` e envia `pairingCode` pela entrada padrão do processo.

O código deve ser usado somente em memória, nunca incluído na linha de comando, gravado ou enviado a logs persistentes.

## budget_mobile_publish

Entradas opcionais:

- `target`: endereço `IP:PORTA` atual;
- `skipWebBuild`: reutiliza o build Angular existente quando verdadeiro.

Executa `mobile-publish.ps1`, adicionando apenas os parâmetros validados.

A tool deve ter timeout suficiente para Angular, Gradle, instalação e abertura do app, capturar stdout/stderr e retornar claramente etapa, código de saída e erro.
