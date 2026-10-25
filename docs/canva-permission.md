# Canva — шаблондарды қолдану рұқсаты

Рұқсатты Canva Developer & Licensing Partnerships Team берді (2026-10, хатты иесі жіберді). Біз шарттарды қабылдап, техникалық тәсілімізді растау хатында жаздық (төменде).

## Шарттар
- **Шаблон саны:** 100-ге дейін (`products/presentation/library/canva.json`, тест тексереді).
- **Атрибуция:** әр презентацияның credits слайдында анық «Designed with Canva» жазуы, сондай-ақ сервистің ішінде (боттың /help мәтіні).
- **Кемінде 15% өзгеріс:** мәтін, тақырыпқа сай суреттер, макет. Өңделмеген бос шаблонды таратуға тыйым салынады.
- **Экспорт:** дайын презентацияны өңделетін .pptx етіп беруге рұқсат.
- **Демо:** соңғы бекітуге демо сілтемесін жіберу керек.

## Біздің тәсіл (растау хатында жазылған)
Шаблондар бір рет .pptx етіп жүктеледі және тек біздің жеке қоймада сақталады (Railway Bucket, `canva/<designId>.pptx`; git-ке салынбайды).
Әр презентацияда шаблонның көшірмесі студенттің мазмұнымен толтырылады; әр презентацияға Canva API-ге сұраныс жіберілмейді.
Студент тек толтырылған .pptx алады — бот галерея, бос шаблон не жүктеу бетін көрсетпейді.

## Кодта қалай сақталады
- Дайындау: `scripts/canva-prepare.py` — қазақ әріптері жоқ Canva қаріптері ұқсас толық Google қаріпіне ауысып, файлға ендіріледі; суреттер кішірейтіледі.
- Каталог: `scripts/canva-catalog.js` слайд рөлдерін автоматты анықтайды, сосын адам рендерді көзбен тексеріп түзетеді → `canva.json`.
- Қойма: `products/presentation/library/s3.js` (`LIBRARY_S3_*` айнымалылары). Жүктеу: `PUT /api/library/:id` тек `LIBRARY_UPLOAD_TOKEN` орнатылғанда ашық (жүктеп болған соң айнымалы өшіріледі).
- Credits: `library.canvaCredits` — шаблонның жабу (болмаса мұқаба) слайды стилінде «Designed with Canva» + www.canva.com сілтемесі, басқа мәтін алынады.
- Таңдау үлесі: `LIBRARY_CANVA_SHARE` (әдепкі 0.75).

## Canva хаты
> Hello Myrzabek,
>
> Thank you for reaching out and for your detailed explanation regarding your service, DeadLine.
>
> We have reviewed your request for integrating Canva templates and the Autofill API into your Telegram bot. We are pleased to approve your request under the following specific conditions:
>
> 1. Template Limit: You are granted permission to access and use up to 100 presentation templates in your service.
> 2. Mandatory Attribution: Clear and visible credit to Canva (e.g., "Designed with Canva") must be retained on the credits slide of every generated presentation and within your service.
> 3. Minimum Customization: At least 15% of the original template (including layout adjustments, topic-specific media, and custom text) must be modified. Direct redistribution of raw, unmodified templates is strictly prohibited.
>
> Regarding the Autofill API, exporting the finalized presentations as editable PowerPoint (.pptx) files is permitted as long as all the conditions above are strictly met.
>
> Please confirm your acceptance of these terms. You may also send over the demo link for final approval once ready.
>
> Best regards,
> Canva Developer & Licensing Partnerships Team

## Біздің растау хатымыз
> We confirm that we accept the terms:
>
> 1. **Template limit.** We will use no more than 100 Canva presentation templates in DeadLine.
> 2. **Attribution.** Every generated presentation will include a credits slide with a clear, visible "Designed with Canva" credit. Canva will also be credited inside the service (in the bot's description and information section).
> 3. **Minimum customization.** Every presentation is generated for a specific student topic. All template text is replaced with new content, and stock photos are replaced with topic-specific images. This is well above the 15% minimum. Raw or unmodified templates are never distributed: students only receive the finished, filled presentation, and the bot has no template gallery or download page.
>
> To be transparent about our technical approach: we plan to download the approved templates once as .pptx files and store them privately on our server. Our system then fills each copy with the student's content and delivers the finished file as an editable .pptx through our Telegram bot. We will not send requests to the Autofill API for every presentation. Please let us know if this approach is acceptable under the license, or if you would prefer us to use the Autofill API instead.
