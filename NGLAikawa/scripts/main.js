$(document).ready(function () {
    // Shared Vars
    let paymentAvailable = false
    let userData = JSON.parse(window.localStorage.getItem('userData'))
     // Available in user page
     // userData contains region in sent page
    const userRegion = $("#userRegion").val()
    

    // Mixpanel init
    mixpanel.init("e8e1a30fe6d7dacfa1353b45d6093a00")
    if (userData?.region === "US" || userRegion === "US") {
        mixpanel.track_links(".rizz-button", "rizz_button_clicked")
        mixpanel.track_links(".download-link1", "web_tapped_get_your_own")
        mixpanel.track_links(".download-link2", "web_sent_tapped_get_your_own")
        mixpanel.track_links(".another1", "web_sent_tapped_send_another_message")
    }

    $('.download-link').click(() => {
        $.ajax({
            url: '/api/pixel',
            type: 'POST',
            data: {
                deviceId: window.localStorage.getItem('deviceId')
            }
        }).done(function (data) {
            console.log('Pixel Response', data)
        }).fail(function (err) {
            console.log('Pixel Failed')
        })
    })

    if (window.location.pathname.includes('/celebai')) {
        const firstCeleb = $('.celeb-pic')[0]
        if (firstCeleb) {
            $(firstCeleb).css("border-width", "5px")
        }

        $("textarea").keyup((e) => {
            if (e.currentTarget.value.length > 0) {
                $(".download-prompt").hide()
                $(".button.download-link.download-link1").hide()
            } else {
                $(".download-prompt").show()
                $(".button.download-link.download-link1").show()
            }
        })
    }

    $('.celeb-container').click((e) => {
        $('.celeb-pic').each((_, celeb) => {
            $(celeb).css("border-width", "2px")
        })
        const celeb = $(e.currentTarget).children('.celeb-pic')[0];
        const selectedCelebId = $(e.currentTarget).attr("data-voice-id")
        $("#celebSelected").val(selectedCelebId)
        $(celeb).css("border-width", "5px")
    })

    // Stripe init
    const stripe = Stripe('pk_live_51KwBgeDayQIxBLDTG6X0rPdazndS0eXsXGLzJExz4TA9TmUMUUfXYflI17I7sE1ZRiE8t9YClg9cUZFRiDYOM36r00oOijCjA4', { apiVersion: "2020-08-27" });
    // const stripe = Stripe('pk_test_51KwBgeDayQIxBLDTPwldL4ZFkmIHUxl45l1GuKkkbSdzzutPEoxgLoHnCn63onsJwpV9wxHAe81a5KDrBmkhOMSx00arm3Ci9l', { apiVersion: "2020-08-27" });

    const paymentRequest = stripe.paymentRequest({
        country: 'US',
        currency: 'usd',
        total: {
            label: 'Boost Message',
            amount: 99,
        },
        requestPayerName: true,
        requestPayerEmail: true,
    });

    // Payment request
    paymentRequest.canMakePayment().then(result => {
        // mixpanel.track("payment_available_new", {
        //     paymentAvailable: result?.applePay ? 'applePay' : result?.googlePay ? 'googlePay' : result?.link ? 'link' : null
        // })
        if (result?.applePay) {
            console.log('ApplePay Enabled')
            paymentAvailable = 'applePay'
        } else if (result?.googlePay) {
            console.log('GooglePay Enabled')
            paymentAvailable = 'googlePay'
        } else if (result?.link) {
            console.log('Link Enabled')
            paymentAvailable = 'link'
        } else {
            console.log('no payment available')
        }
    })

    // Listen for Payment
    paymentRequest.on('paymentmethod', async (ev) => {
        // Send request to /api/getPaymentIntent using jQuery ajax
        const data = await $.ajax({
            url: '/api/getPaymentIntent',
            method: 'POST',
            data: { questionId: userData.questionId }
        });

        // Confirm the PaymentIntent without handling potential next actions (yet).
        const { paymentIntent, error: confirmError } = await stripe.confirmCardPayment(
            data.clientSecret,
            { payment_method: ev.paymentMethod.id },
            { handleActions: false }
        );

        if (confirmError) {
            if (userData?.region === "US") {
                mixpanel.track("priority_inbox_payment_failed")
            }
            ev.complete('fail')
            return alert("Your payment method failed. Try again or skip.")
        }

        if (paymentIntent.status === "requires_action") {
            const { error } = await stripe.confirmCardPayment(data.clientSecret);
            if (error) return alert("Your payment method failed. Try again or skip.")
        }

        ev.complete('success')
        if (userData?.region === "US") {
            mixpanel.track("priority_inbox_payment_succeeded")
        }

        $('.modal-container').addClass('off')
        setTimeout(() => {
            $('.modal-container').hide()
        }, 300)

        userData.isBoosted = true
        window.localStorage.setItem('userData', JSON.stringify(userData))
        isBoostedUI()
    });

    function isBoostedUI() {
        $('.boost').addClass('button-translucent')
        $('.boost').removeClass('button-white')
        $('.boost').removeClass('pulse')
        $('.boost').text(window.translations.boosted)
        $('.boost').off("click")
    }

    // /p/sent logic
    if (window.location.pathname.includes('p/sent')) {
        // UI
        $('.modal-container').hide()
        $('.pfp').attr('src', userData?.ig_pfp_url)
        if (userData?.isBoosted && false) isBoostedUI()
        if (userData?.priorityInboxEnabled && userData?.paymentAvailable && false) {
            $('.boost').show()
            $('.boost').addClass('pulse')
            // mixpanel.track("web_sent_seen_boosted_button")
        } else {
            $('.boost').hide()
            $('.download-link').addClass('pulse')
        }

        // Handlers
        $('.boost').click(() => {
            if (userData?.region === "US") {
                mixpanel.track("web_sent_tapped_boosted_button")
            }
            $('.modal-container').show()
            $('.modal-container').removeClass('off')
        })
        $('.modal-bg, .priority-x').click(() => {
            if (userData?.region === "US") {
                mixpanel.track("web_sent_boosted_menu_tapped_hide")
            }
            // mixpanel.track("priority_inbox_skipped")
            $('.modal-container').addClass('off')
            setTimeout(() => {
                $('.modal-container').hide()
            }, 300)
        })
        $('.pay').click(async () => {
            if (paymentAvailable) {
                // let r = await $.ajax({
                //     url: '/api/stripe-checkout',
                //     type: 'POST'
                // })
                // window.location.href = r.url
                if (userData?.region === "US") {
                    mixpanel.track("web_sent_boosted_menu_tapped_pay")
                    mixpanel.track("priority_inbox_payment_clicked")
                }
                paymentRequest.show()
            } else {
                if (userData?.region === "US") {
                    mixpanel.track("web_sent_boosted_menu_tapped_pay_failed")
                }
                alert('Please try again in a few seconds.')
            }
        })

    } else {
        // /username/game logic
        window.localStorage.removeItem('userData')
    }

    if (window.location.pathname.includes('p/voiceSent')) {
        // if (gameSlug === "celebai") {
        //     window.localStorage.setItem('voiceData', JSON.stringify({
        //         voiceUrl: data.voiceUrl,
        //         voiceName: data.voiceName,
        //         voiceImageUrl: data.voiceImageUrl
        //     }))
        // }
        // Get Parsed Voice Data
        let voiceData = window.localStorage.getItem('voiceData')
        if (voiceData) {
            voiceData = JSON.parse(voiceData)
            // Set .playerContainer background image
            $('.playerContainer').css('background-image', `url(${voiceData.voiceImageUrl})`)

            $('.playButton').click(() => {
                // There's an audio element with class .audioPlayer
                // The audio file URL is data.voiceUrl
                // Play the audio file in the audio element here
                $('.audioPlayer').attr('src', voiceData.voiceUrl)
                $('.audioPlayer')[0].play()

                // Hide the play button
                $('.playButton').hide()

                // Re-show the play button when audio complete
                $('.audioPlayer')[0].onended = () => {
                    $('.playButton').show()
                }
            })
        } else {
            $('.playerContainer').hide()
        }

    }

    // Asking question form
    $('.form').submit(function (e) {
        e.preventDefault();
        if (window.location.pathname.includes('voiceai')) {
            $('textarea')[0].value = ''
            alert(`Message Sent!`)
            return
        }

        if ($('#question').val().trim() === '') {
            return alert('Please enter a question first!')
        }

        $('.submit').attr('disabled', true)
        const userRegion = $("#userRegion").val()
        if (userRegion === "US") {
            mixpanel.track("web_tapped_send")
        }

        let referrer = document.referrer
        if (navigator.userAgent.includes("Snapchat")) referrer = "https://snapchat.com"

        let data = {
            username: username,
            question: $('#question').val(),
            deviceId: $('.deviceId').val(),
            gameSlug: gameSlug,
            referrer: referrer
        }

        if (gameSlug === "celebai") {
            data.voiceId = $("#celebSelected").val()
        }

        $.ajax({
            url: '/api/submit',
            type: 'POST',
            data
        }).done(function (data) {
            console.log('Sent Question', data)
            window.localStorage.setItem('userData', JSON.stringify({
                questionId: data.questionId,
                priorityInboxEnabled,
                paymentAvailable,
                ig_pfp_url,
                ig_username,
                region: data.userRegion,
            }))

            const userLanguage = $("meta[name='user:language']").attr("content")
            let url = '/p/sent'

            if (gameSlug === "celebai") {
                window.localStorage.setItem('voiceData', JSON.stringify({
                    voiceUrl: data.voiceUrl,
                    voiceName: data.voiceName,
                    voiceImageUrl: data.voiceImageUrl
                }))

                url = '/p/voiceSent'
            }

            if (gameSlug) url += `/${gameSlug}`
            if (userLanguage) url += `?lng=${userLanguage}`
            window.location.href = url
        }).fail(function (err) {
            console.log('submitted - failed')
            console.log('Error submitting question', err);
            alert('Internet error! Try again')
        })
    })

    window.addEventListener("pageshow", function (event) {
        var historyTraversal = event.persisted ||
            (typeof window.performance != "undefined" &&
                window.performance.navigation.type === 2);
        if (historyTraversal) {
            // Handle page restore.
            $('.submit').attr('disabled', false)
            $('textarea').val('')
            $('.bottom-container').show()
            $('.priority-modal').hide()
            if (!(/android/i.test(userAgent))) {
                $('.submit').hide()
            }
        }
    });

    const userAgent = navigator.userAgent || navigator.vendor || window.opera
    if (/android/i.test(userAgent)) {
        // NGL Download Link
        $('.download-link').attr('href', 'https://play.google.com/store/apps/details?id=com.nglreactnative')

        // Rizz Download link
        $('.rizz-button').attr('href', 'https://play.google.com/store/apps/details?id=com.rizz.android')
    }

    $('textarea').focus(function () {
        $('.bottom-container').hide()
    })

    $('textarea').blur(function () {
        $('.bottom-container').show()
    })

    $('textarea').on('input', function (e) {
        if (e.target.value == '' && !(/android/i.test(userAgent))) {
            $('.submit').hide()
        } else {
            $('.submit').show()
        }
    });

    if (!(/android/i.test(userAgent))) {
        $('.submit').hide()
    }

    // TODO: Move default game fake questions to web simplelocalize
    const APP_CDN_BASE_URL = "https://cdn.simplelocalize.io/57157aec81d54cb6b2a43f8b34a61d47/_production/";
    const userLanguage = $("meta[name='user:language']").attr("content") || 'en';
    let randomQuestions = []

    $.get(APP_CDN_BASE_URL + userLanguage, function (data) {
        const fakeQuestionKeys = Object.keys(data).filter(key => key.startsWith('FAKE_QUESTIONS.'))
        randomQuestions = fakeQuestionKeys.map(key => data[key])
    });


    $('.dice-button').click(function (e) {
        // Set textarea text to a random question
        const randomQuestion = randomQuestions[Math.floor(Math.random() * randomQuestions.length)];
        $('textarea').val(randomQuestion + ' ')
        $('textarea').focus()
        $('textarea')[0].selectionStart = randomQuestion.length + 1
        $('textarea')[0].selectionEnd = randomQuestion.length + 1

        $('.submit').show()

        e.preventDefault()
    })

    if (!window.localStorage.getItem('deviceId')) {
        function uuidv4() {
            return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
                (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
            );
        }
        window.localStorage.setItem('deviceId', uuidv4())
    }

    $('.deviceId').val(window.localStorage.getItem('deviceId'))

    setInterval(() => {
        let clickCount = parseInt($('.clickCount').text())
        clickCount += Math.floor(Math.random() * 5) - 1
        $('.clickCount').text(clickCount)
    }, 800)

    // Pageview
    if (!window.location.pathname.includes('p/sent')) {
        if (userRegion === "US") {
            mixpanel.track("web_viewed_pageview", { "distinct_id": uid, referrer: window.document.referrer })
        }

        $.ajax({
            url: '/api/pageview',
            type: 'POST',
            data: {
                uid: uid,
                referrer: window.document.referrer,
                game: gameId,
                deviceId: window.localStorage.getItem('deviceId')
            }
        }).done(function (data) {
            console.log(data)
        })
    }
});