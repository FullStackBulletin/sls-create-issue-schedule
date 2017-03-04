import truncate from 'truncate';

const escapeAttrNodeValue = value =>
  value.replace(/(&)|(")|(\u00A0)/g, (match, amp, quote) => {
    if (amp) return '&amp;';
    if (quote) return '&quot;';
    return '&nbsp;';
  })
;

const a = (url, content) => {
  if (url) {
    return `<a href="${escapeAttrNodeValue(url)}" target="_blank">${content}</a>`;
  }

  return content;
};

const img = (url, title) =>
  `<img alt="${escapeAttrNodeValue(title)}" src="${url}" width="194" style="max-width:500px;" class="mcnImage">`;

const desc = (url, description) =>
  `${truncate(description, 300)}<br/>${a(url, 'Read article')}`;

export const createCampaignFactory = (httpClient, apiKey) => {
  const [, dc] = apiKey.split('-');
  const apiEndpoint = `https://user:${apiKey}@${dc}.api.mailchimp.com/3.0`;

  return (quote, links, campaignSettings) => {
    // 1. create campaign
    const createCampaignUrl = `${apiEndpoint}/campaigns`;
    const campaignData = {
      type: 'regular',
      recipients: {
        list_id: campaignSettings.listId,
      },
      settings: {
        subject_line: `🤓 fullstackBulletin issue ${campaignSettings.weekNumber}: ${links[0].title}`,
        title: campaignSettings.campaignName,
        from: campaignSettings.from,
        from_name: campaignSettings.fromName,
        reply_to: campaignSettings.replyTo,
      },
    };

    let campaignId = null;

    return httpClient.post(createCampaignUrl, campaignData)
    .then((response) => {
      // 2. create content
      campaignId = response.data.id;
      const createCampaignContentUrl = `${apiEndpoint}/campaigns/${campaignId}/content`;
      const contentData = {
        template: {
          id: campaignSettings.templateId,
          sections: {
            content_preview: links[0].title,
            quote_text: quote.text,
            quote_author: a(quote.authorUrl, quote.author),
            quote_author_description: quote.authorDescription,
            title: `Best 7 links of week #${campaignSettings.weekNumber}, ${campaignSettings.year}`,
          },
        },
      };

      links.forEach((link, i) => {
        contentData.template.sections[`article_title_${i + 1}`] =
          a(link.campaignUrls.title, link.title);

        contentData.template.sections[`article_description_${i + 1}`] =
          desc(link.campaignUrls.description, link.description);

        contentData.template.sections[`image_${i + 1}`] =
          a(link.campaignUrls.image, img(link.image, link.title));
      });

      return httpClient.put(createCampaignContentUrl, contentData);
    })
    .then(() => {
      // 3. schedule campaign
      const scheduleCampaignUrl = `${apiEndpoint}/campaigns/${campaignId}/actions/schedule`;
      return httpClient.post(scheduleCampaignUrl, {
        schedule_time: campaignSettings.scheduleTime,
      });
    })
    .then(() => {
      // 4. send test email
      const sendTestEmailUrl = `${apiEndpoint}/campaigns/${campaignId}/actions/test`;
      return httpClient.post(sendTestEmailUrl, {
        test_emails: campaignSettings.testEmails,
        send_type: 'html',
      });
    });
  };
};

export default {
  createCampaignFactory,
};
